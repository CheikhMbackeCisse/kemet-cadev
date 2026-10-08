import type { FastifyInstance } from "fastify";
import { markReadSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, notFound } from "../../errors.js";
import { findMessageById, markChannelRead } from "../repositories/chat.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import type { ChatAppDeps } from "../app.js";
import { requireChannelAccess } from "./channels.js";

export function registerReadStateRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  app.post<{ Params: { id: string } }>("/api/channels/:id/read", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile) throw badRequest("Complétez votre profil avant de marquer un salon comme lu.");
    await requireChannelAccess(db, request.params.id, profile.id);
    const input = markReadSchema.parse(request.body);
    const message = await findMessageById(db, input.messageId);
    if (!message || message.channelId !== request.params.id) {
      throw notFound("Ce message n'existe pas dans ce salon.");
    }
    await markChannelRead(db, request.params.id, profile.id, input.messageId);
    return { read: true };
  });
}
