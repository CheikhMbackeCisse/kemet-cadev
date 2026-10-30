import type { FastifyInstance } from "fastify";
import { createChannelSchema, renameChannelSchema } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  countUnreadMessages,
  createChannel,
  findChannelById,
  findSpaceById,
  findSpaceMembership,
  listChannelsBySpace,
  renameChannel,
} from "../repositories/chat.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializeChannel } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'accéder aux salons.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// `null` pour un visiteur, sans session.
async function findOwnProfile(db: ChatAppDeps["db"], userId: string | null) {
  return userId ? findProfileByUserId(db, userId) : null;
}

export async function requireChannelAccess(db: ChatAppDeps["db"], channelId: string, profileId: string | null) {
  const channel = await findChannelById(db, channelId);
  if (!channel) throw notFound("Ce salon n'existe pas.");
  const space = await findSpaceById(db, channel.spaceId);
  if (!space) throw notFound("Ce salon n'existe pas.");
  const membership = profileId ? await findSpaceMembership(db, space.id, profileId) : null;
  if (space.visibility === "private" && !membership) throw notFound("Ce salon n'existe pas.");
  return { channel, space, membership };
}

function requireAdmin(membership: { role: string } | null) {
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw forbidden("Seuls les administrateurs de l'espace peuvent faire cette action.");
  }
}

export function registerChannelRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  app.get<{ Params: { id: string } }>("/api/spaces/:id/channels", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = await findOwnProfile(db, userId);
    const space = await findSpaceById(db, request.params.id);
    if (!space) throw notFound("Cet espace n'existe pas.");
    const membership = profile ? await findSpaceMembership(db, space.id, profile.id) : null;
    if (space.visibility === "private" && !membership) throw notFound("Cet espace n'existe pas.");
    const since = membership?.joinedAt ?? space.createdAt;
    const channelRows = await listChannelsBySpace(db, space.id);
    const items = await Promise.all(
      channelRows.map(async (channel) => {
        const unreadCount = profile ? await countUnreadMessages(db, channel.id, profile.id, since) : 0;
        return serializeChannel(channel, unreadCount);
      }),
    );
    return { items };
  });

  app.post<{ Params: { id: string } }>(
    "/api/spaces/:id/channels",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const space = await findSpaceById(db, request.params.id);
      if (!space) throw notFound("Cet espace n'existe pas.");
      const membership = await findSpaceMembership(db, space.id, profile.id);
      if (space.visibility === "private" && !membership) throw notFound("Cet espace n'existe pas.");
      requireAdmin(membership);
      const input = createChannelSchema.parse(request.body);
      const existing = (await listChannelsBySpace(db, space.id)).find((channel) => channel.slug === input.slug);
      if (existing) throw conflict("Un salon avec cet identifiant existe déjà dans cet espace.");
      const displayOrder = (await listChannelsBySpace(db, space.id)).length;
      const channel = await createChannel(db, space.id, input.name, input.slug, displayOrder);
      return { channel: serializeChannel(channel, 0) };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/channels/:id",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { membership } = await requireChannelAccess(db, request.params.id, profile.id);
      requireAdmin(membership);
      const input = renameChannelSchema.parse(request.body);
      const channel = await renameChannel(db, request.params.id, input.name);
      const since = membership?.joinedAt ?? channel.createdAt;
      const unreadCount = await countUnreadMessages(db, channel.id, profile.id, since);
      return { channel: serializeChannel(channel, unreadCount) };
    },
  );
}
