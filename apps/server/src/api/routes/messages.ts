import type { FastifyInstance } from "fastify";
import {
  channelMessagesQuerySchema,
  createMessageSchema,
  editMessageSchema,
  paginationQuerySchema,
  toggleReactionSchema,
} from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { extractMentionHandles } from "../../chat/mentions.js";
import { mentionsAssistant } from "../../chat/kemet-assistant.js";
import {
  findMessageById,
  editMessage,
  findFirstUnreadMessageId,
  hydrateMessage,
  insertMentions,
  insertMessage,
  listChannelMessages,
  listThreadReplies,
  resolveMentionableProfiles,
  softDeleteMessage,
  toggleReaction,
} from "../repositories/chat.js";
import { attachToMessage, findPendingAttachment } from "../repositories/attachments.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializeMessage } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { requireChannelAccess } from "./channels.js";

const MAX_MESSAGES_PER_MINUTE = 20;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'écrire dans un salon.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// `null` pour un visiteur (pas de session, mode visiteur du lot 11a) : les
// deux routes de lecture ci-dessous l'acceptent, jamais les routes d'écriture.
async function findOwnProfile(db: ChatAppDeps["db"], userId: string | null) {
  return userId ? findProfileByUserId(db, userId) : null;
}

async function toSerializedMessage(db: ChatAppDeps["db"], row: Awaited<ReturnType<typeof findMessageById>>) {
  const hydrated = await hydrateMessage(db, row!);
  return serializeMessage(
    hydrated.row,
    hydrated.author,
    hydrated.mentionedHandles,
    hydrated.reactions,
    hydrated.replyCount,
    hydrated.attachments,
  );
}

export function registerMessageRoutes(
  app: FastifyInstance,
  { db, auth, chat, assistant, antiSpamConfig }: ChatAppDeps,
): void {
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/channels/:id/messages",
    async (request) => {
      const userId = await getSessionUserId(auth, request);
      const profile = await findOwnProfile(db, userId);
      const { membership } = await requireChannelAccess(db, request.params.id, profile?.id ?? null);
      const query = channelMessagesQuerySchema.parse(request.query);
      const page = await listChannelMessages(db, request.params.id, query.cursor, query.limit);
      const items = await Promise.all(page.items.map((row) => toSerializedMessage(db, row)));
      // Seulement à l'ouverture (première page) et pour un membre : un visiteur
      // ou un non-membre d'un espace public n'a pas d'état de lecture.
      const firstUnreadMessageId =
        !query.cursor && profile && membership
          ? await findFirstUnreadMessageId(db, request.params.id, profile.id, membership.joinedAt)
          : null;
      return { items, nextCursor: page.nextCursor, firstUnreadMessageId };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/messages/:id/replies",
    async (request) => {
      const userId = await getSessionUserId(auth, request);
      const profile = await findOwnProfile(db, userId);
      const parent = await findMessageById(db, request.params.id);
      if (!parent) throw notFound("Ce message n'existe pas.");
      await requireChannelAccess(db, parent.channelId, profile?.id ?? null);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listThreadReplies(db, request.params.id, query.cursor, query.limit);
      const items = await Promise.all(page.items.map((row) => toSerializedMessage(db, row)));
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/channels/:id/messages",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_MESSAGES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { channel, space } = await requireChannelAccess(db, request.params.id, profile.id);
      const input = createMessageSchema.parse(request.body);

      if (input.parentMessageId) {
        const parent = await findMessageById(db, input.parentMessageId);
        if (!parent || parent.channelId !== channel.id) {
          throw badRequest("Le message parent n'existe pas dans ce salon.");
        }
      }

      // Transaction : si la validation des fichiers échoue, l'insertion du
      // message est annulée avec elle. Sans ça, une relance réseau avec le
      // même clientId retomberait sur un message déjà créé mais sans ses
      // fichiers, sans jamais pouvoir les rattacher (voir message:new et la
      // déduplication par clientId dans docs/adr/0006-temps-reel.md).
      const { message, created } = await db.transaction(async (tx) => {
        const result = await insertMessage(tx, {
          channelId: channel.id,
          authorId: profile.id,
          clientId: input.clientId,
          body: input.body,
          parentMessageId: input.parentMessageId ?? null,
        });

        if (result.created) {
          const attachmentIds = input.attachmentIds ?? [];
          for (const attachmentId of attachmentIds) {
            const pending = await findPendingAttachment(tx, attachmentId, profile.id, channel.id);
            if (!pending) {
              throw badRequest("Un fichier envoyé n'est plus disponible pour ce message.");
            }
          }
          const handles = extractMentionHandles(input.body);
          const mentioned = await resolveMentionableProfiles(tx, space.id, handles);
          await insertMentions(tx, result.message.id, mentioned.map((profile) => profile.id));
          await attachToMessage(tx, attachmentIds, result.message.id);
        }

        return result;
      });

      const serialized = await toSerializedMessage(db, message);
      if (created) {
        await chat.publish({ type: "message:new", channelId: channel.id, message: serialized });
        if (mentionsAssistant(input.body)) {
          // Volontairement non attendu : la réponse HTTP ne doit pas attendre
          // la fin du flux de l'assistant, diffusé à part par Socket.IO
          // (voir apps/server/src/ai/assistant-orchestrator.ts). Une erreur
          // ici est déjà transformée en événement assistant:failed par
          // l'orchestrateur, donc seulement journalisée si elle s'en échappe.
          assistant
            .handleMention({
              channelId: channel.id,
              triggerMessageId: message.id,
              requestedBy: profile.id,
              body: input.body,
            })
            .catch((error) => app.log.error(error, "échec de l'invocation de l'assistant"));
        }
      }
      return { message: serialized };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/messages/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const message = await findMessageById(db, request.params.id);
      if (!message || message.deletedAt) throw notFound("Ce message n'existe pas.");
      await requireChannelAccess(db, message.channelId, profile.id);
      if (message.authorId !== profile.id) throw forbidden("Seul l'auteur peut modifier ce message.");
      const input = editMessageSchema.parse(request.body);
      const updated = await editMessage(db, message.id, input.body);
      const serialized = await toSerializedMessage(db, updated);
      await chat.publish({ type: "message:updated", channelId: message.channelId, message: serialized });
      return { message: serialized };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/messages/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const message = await findMessageById(db, request.params.id);
      if (!message || message.deletedAt) throw notFound("Ce message n'existe pas.");
      const { membership } = await requireChannelAccess(db, message.channelId, profile.id);
      const isAuthor = message.authorId === profile.id;
      const isAdmin = membership?.role === "owner" || membership?.role === "admin";
      if (!isAuthor && !isAdmin) throw forbidden("Impossible de supprimer le message d'un autre membre.");
      await softDeleteMessage(db, message.id);
      await chat.publish({ type: "message:deleted", channelId: message.channelId, messageId: message.id });
      return { deleted: true };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/messages/:id/reactions",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const message = await findMessageById(db, request.params.id);
      if (!message || message.deletedAt) throw notFound("Ce message n'existe pas.");
      await requireChannelAccess(db, message.channelId, profile.id);
      const input = toggleReactionSchema.parse(request.body);
      const reactions = await toggleReaction(db, message.id, profile.id, input.emoji);
      await chat.publish({
        type: "reaction:updated",
        channelId: message.channelId,
        messageId: message.id,
        reactions,
      });
      return { reactions };
    },
  );
}
