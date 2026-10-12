import type { FastifyInstance } from "fastify";
import { createInviteSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import {
  createInvite,
  findInviteByCode,
  findInviteById,
  findSpaceById,
  findSpaceMembership,
  listSpaceInvites,
  redeemInvite,
  revokeInvite,
} from "../repositories/chat.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializeInvite } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de gérer les invitations.");
  return profile;
}

function requireAdmin(membership: { role: string } | null) {
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw forbidden("Seuls les administrateurs de l'espace peuvent faire cette action.");
  }
}

export function registerInviteRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  app.post<{ Params: { id: string } }>(
    "/api/spaces/:id/invites",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const space = await findSpaceById(db, request.params.id);
      if (!space) throw notFound("Cet espace n'existe pas.");
      const membership = await findSpaceMembership(db, space.id, profile.id);
      requireAdmin(membership);
      const input = createInviteSchema.parse(request.body);
      const invite = await createInvite(db, {
        spaceId: space.id,
        createdBy: profile.id,
        maxUses: input.maxUses ?? null,
        expiresInDays: input.expiresInDays,
      });
      return { invite: serializeInvite(invite, profile.handle) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/spaces/:id/invites", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const space = await findSpaceById(db, request.params.id);
    if (!space) throw notFound("Cet espace n'existe pas.");
    const membership = await findSpaceMembership(db, space.id, profile.id);
    requireAdmin(membership);
    const rows = await listSpaceInvites(db, space.id);
    return { items: rows.map((row) => serializeInvite(row.invite, row.createdByHandle)) };
  });

  app.delete<{ Params: { inviteId: string } }>(
    "/api/invites/:inviteId",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const invite = await findInviteById(db, request.params.inviteId);
      if (!invite) throw notFound("Cette invitation n'existe pas.");
      const membership = await findSpaceMembership(db, invite.spaceId, profile.id);
      requireAdmin(membership);
      await revokeInvite(db, invite.id);
      return { revoked: true };
    },
  );

  app.get<{ Params: { code: string } }>(
    "/api/invites/:code",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const invite = await findInviteByCode(db, request.params.code);
      if (!invite) return { status: "not_found", spaceName: null };
      if (invite.revokedAt) return { status: "revoked", spaceName: null };
      if (invite.expiresAt.getTime() < Date.now()) return { status: "expired", spaceName: null };
      if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return { status: "exhausted", spaceName: null };
      const space = await findSpaceById(db, invite.spaceId);
      return { status: "valid", spaceName: space?.name ?? null };
    },
  );

  app.post<{ Params: { code: string } }>(
    "/api/invites/:code/accept",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const result = await redeemInvite(db, request.params.code, profile.id);
      if (result.status !== "ok") {
        return { joined: false, status: result.status };
      }
      return { joined: true, status: "ok", spaceId: result.spaceId };
    },
  );
}
