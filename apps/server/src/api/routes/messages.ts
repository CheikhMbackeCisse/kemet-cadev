import type { FastifyInstance } from "fastify";
import { createMessageSchema, editMessageSchema, paginationQuerySchema, toggleReactionSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { extractMentionHandles } from "../../chat/mentions.js";
import {
  findMessageById,
  editMessage,
  hydrateMessage,
  insertMentions,
  insertMessage,
  listChannelMessages,
  listThreadReplies,
  resolveMentionableProfiles,
  softDeleteMessage,
  toggleReaction,
} from "../repositories/chat.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializeMessage } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { requireChannelAccess } from "./channels.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'écrire dans un salon.");
  return profile;
}

async function toSerializedMessage(db: ChatAppDeps["db"], row: Awaited<ReturnType<typeof findMessageById>>) {
  const hydrated = await hydrateMessage(db, row!);
  return serializeMessage(hydrated.row, hydrated.author, hydrated.mentionedHandles, hydrated.reactions, hydrated.replyCount);
}

export function registerMessageRoutes(app: FastifyInstance, { db, auth, chat }: ChatAppDeps): void {
  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/channels/:id/messages",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      await requireChannelAccess(db, request.params.id, profile.id);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listChannelMessages(db, request.params.id, query.cursor, query.limit);
      const items = await Promise.all(page.items.map((row) => toSerializedMessage(db, row)));
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/messages/:id/replies",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const parent = await findMessageById(db, request.params.id);
      if (!parent) throw notFound("Ce message n'existe pas.");
      await requireChannelAccess(db, parent.channelId, profile.id);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listThreadReplies(db, request.params.id, query.cursor, query.limit);
      const items = await Promise.all(page.items.map((row) => toSerializedMessage(db, row)));
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/channels/:id/messages",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
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

      const { message, created } = await insertMessage(db, {
        channelId: channel.id,
        authorId: profile.id,
        clientId: input.clientId,
        body: input.body,
        parentMessageId: input.parentMessageId ?? null,
      });

      if (created) {
        const handles = extractMentionHandles(input.body);
        const mentioned = await resolveMentionableProfiles(db, space.id, handles);
        await insertMentions(db, message.id, mentioned.map((profile) => profile.id));
      }

      const serialized = await toSerializedMessage(db, message);
      if (created) {
        await chat.publish({ type: "message:new", channelId: channel.id, message: serialized });
      }
      return { message: serialized };
    },
  );

  app.patch<{ Params: { id: string } }>("/api/messages/:id", async (request) => {
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
  });

  app.delete<{ Params: { id: string } }>("/api/messages/:id", async (request) => {
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
  });

  app.put<{ Params: { id: string } }>("/api/messages/:id/reactions", async (request) => {
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
  });
}
