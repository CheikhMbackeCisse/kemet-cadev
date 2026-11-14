import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import {
  channelMessagesQuerySchema,
  createMessageSchema,
  editMessageSchema,
  paginationQuerySchema,
  toggleReactionSchema,
  type Level,
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
  softDeleteMessages,
  toggleReaction,
} from "../repositories/chat.js";
import { attachToMessage, findPendingAttachment } from "../repositories/attachments.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { computeLevels } from "../repositories/points.js";
import { serializeMessage } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { accessJoinedAt, requireChannelAccess, requireWritableSpace } from "./channels.js";
import { requireCanWrite } from "../../messaging/write-block.js";
import { findMessageByClientId } from "../repositories/conversations.js";
import { listAssistantResponseMessageIds } from "../repositories/assistant.js";
import { publishConversationActivity } from "../../messaging/activity.js";

const MAX_MESSAGES_PER_MINUTE = 20;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'écrire dans un salon.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// `null` pour un visiteur : accepté par les routes de lecture, jamais d'écriture.
async function findOwnProfile(db: ChatAppDeps["db"], userId: string | null) {
  return userId ? findProfileByUserId(db, userId) : null;
}

async function toSerializedMessage(
  db: ChatAppDeps["db"],
  row: Awaited<ReturnType<typeof findMessageById>>,
  levels?: Map<string, Level>,
) {
  const hydrated = await hydrateMessage(db, row!);
  const authorLevels = levels ?? (await computeLevels(db, [hydrated.row.authorId]));
  return serializeMessage(
    hydrated.row,
    hydrated.author,
    hydrated.mentionedHandles,
    hydrated.reactions,
    hydrated.replyCount,
    hydrated.attachments,
    authorLevels.get(hydrated.row.authorId)!,
  );
}

async function toSerializedMessages(db: ChatAppDeps["db"], rows: NonNullable<Awaited<ReturnType<typeof findMessageById>>>[]) {
  const levels = await computeLevels(db, rows.map((row) => row.authorId));
  return Promise.all(rows.map((row) => toSerializedMessage(db, row, levels)));
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
      const access = await requireChannelAccess(db, request.params.id, profile?.id ?? null);
      const joinedAt = accessJoinedAt(access);
      const query = channelMessagesQuerySchema.parse(request.query);
      const page = await listChannelMessages(db, request.params.id, query.cursor, query.limit);
      const items = await toSerializedMessages(db, page.items);
      // Seulement à l'ouverture (première page) et pour un membre : un visiteur
      // ou un non-membre d'un espace public n'a pas d'état de lecture.
      const firstUnreadMessageId =
        !query.cursor && profile && joinedAt
          ? await findFirstUnreadMessageId(db, request.params.id, profile.id, joinedAt)
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
      if (!parent || parent.deletedAt) throw notFound("Ce message n'existe pas.");
      await requireChannelAccess(db, parent.channelId, profile?.id ?? null);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listThreadReplies(db, request.params.id, query.cursor, query.limit);
      const items = await toSerializedMessages(db, page.items);
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
      // La règle d'écriture d'une conversation est vérifiée dans la transaction,
      // où le renvoi d'un message déjà enregistré se reconnaît.
      const access = await requireChannelAccess(db, request.params.id, profile.id);
      if (access.kind === "space") requireWritableSpace(access.space);
      const { channel } = access;
      const input = createMessageSchema.parse(request.body);

      if (input.parentMessageId) {
        const parent = await findMessageById(db, input.parentMessageId);
        if (!parent || parent.deletedAt || parent.channelId !== channel.id) {
          throw badRequest("Le message parent n'existe pas dans ce salon.");
        }
        // Un seul niveau de fil : on répond au message d'origine, pas à une réponse.
        if (parent.parentMessageId) throw badRequest("On ne répond pas à une réponse dans un fil.");
      }

      // Transaction : sinon un renvoi avec le même clientId retomberait sur
      // un message créé sans ses fichiers, sans pouvoir les rattacher.
      const { message, created } = await db.transaction(async (tx) => {
        if (access.kind === "conversation") {
          // Deux envois parallèles passeraient tous deux la limite d'un
          // message avant acceptation : on la revérifie sous un verrou par
          // conversation, sauf pour le renvoi d'un message déjà enregistré.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${channel.id}))`);
          if (!(await findMessageByClientId(tx, profile.id, input.clientId))) {
            await requireCanWrite(tx, access.conversation, access.member, channel.id);
          }
        }
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
          // Pas de mention dans une conversation privée : tout le monde y lit tout.
          if (access.kind === "space") {
            const handles = extractMentionHandles(input.body);
            const mentioned = await resolveMentionableProfiles(tx, access.space.id, handles);
            await insertMentions(tx, result.message.id, mentioned.map((profile) => profile.id));
          }
          await attachToMessage(tx, attachmentIds, result.message.id);
        }

        return result;
      });

      const serialized = await toSerializedMessage(db, message);
      if (created) {
        await chat.publish({ type: "message:new", channelId: channel.id, message: serialized });
        if (access.kind === "conversation") {
          await publishConversationActivity(db, chat, access.conversation.id);
        }
        // @kemet ne lit jamais une conversation privée.
        if (access.kind === "space" && mentionsAssistant(input.body)) {
          // Non attendu : la réponse de l'assistant part par Socket.IO, et
          // l'orchestrateur traduit déjà ses erreurs en assistant:failed.
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
      const access = await requireChannelAccess(db, message.channelId, profile.id);
      if (access.kind === "conversation") {
        await requireCanWrite(db, access.conversation, access.member, access.channel.id);
      } else {
        requireWritableSpace(access.space);
      }
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
      const access = await requireChannelAccess(db, message.channelId, profile.id);
      const isAuthor = message.authorId === profile.id;
      const isAdmin =
        access.kind === "space" && (access.membership?.role === "owner" || access.membership?.role === "admin");
      if (!isAuthor && !isAdmin) throw forbidden("Impossible de supprimer le message d'un autre membre.");
      // La réponse de l'assistant à cette question part avec elle.
      const assistantResponseIds = await listAssistantResponseMessageIds(db, message.id);
      await softDeleteMessages(db, [message.id, ...assistantResponseIds]);
      await chat.publish({
        type: "message:deleted",
        channelId: message.channelId,
        messageId: message.id,
        parentMessageId: message.parentMessageId,
      });
      for (const id of assistantResponseIds) {
        await chat.publish({
          type: "message:deleted",
          channelId: message.channelId,
          messageId: id,
          parentMessageId: null,
        });
      }
      if (access.kind === "conversation") {
        await publishConversationActivity(db, chat, access.conversation.id);
      }
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
      const access = await requireChannelAccess(db, message.channelId, profile.id);
      if (access.kind === "conversation") {
        await requireCanWrite(db, access.conversation, access.member, access.channel.id);
      } else {
        requireWritableSpace(access.space);
      }
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
