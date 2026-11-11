import type { FastifyInstance } from "fastify";
import { addSpaceMemberSchema, createSpaceSchema, paginationQuerySchema } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  addSpaceMember,
  countSpaceMembers,
  countSpaceMembersBatch,
  findSpacesWithUnread,
  createSpaceWithDefaults,
  findSpaceById,
  findSpaceBySlug,
  findSpaceMembership,
  listSpaceMembers,
  listSpacesForViewer,
  findMostActivePublicSpaceId,
  removeSpaceMember,
} from "../repositories/chat.js";
import { findProfileByHandle, findProfileByUserId } from "../repositories/profiles.js";
import { leaveSpace } from "../repositories/space-ownership.js";
import { requireWritableSpace } from "./channels.js";
import { serializeSpace, serializeSpaceMember } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de créer ou rejoindre un espace.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// `null` pour un visiteur : les routes de lecture l'appellent au lieu de requireOwnProfile.
async function findOwnProfile(db: ChatAppDeps["db"], userId: string | null) {
  return userId ? findProfileByUserId(db, userId) : null;
}

async function requireVisibleSpace(
  db: ChatAppDeps["db"],
  spaceId: string,
  profileId: string | null,
) {
  const space = await findSpaceById(db, spaceId);
  if (!space) throw notFound("Cet espace n'existe pas.");
  const membership = profileId ? await findSpaceMembership(db, spaceId, profileId) : null;
  if (space.visibility === "private" && !membership) throw notFound("Cet espace n'existe pas.");
  return { space, membership };
}

function requireAdmin(membership: { role: string } | null) {
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw forbidden("Seuls les administrateurs de l'espace peuvent faire cette action.");
  }
}

const MOST_ACTIVE_WINDOW_DAYS = 7;

export function registerSpaceRoutes(app: FastifyInstance, { db, auth, chat }: ChatAppDeps): void {
  app.post(
    "/api/spaces",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = createSpaceSchema.parse(request.body);
      if (await findSpaceBySlug(db, input.slug)) {
        throw conflict("Cet identifiant d'espace est déjà pris.");
      }
      const space = await createSpaceWithDefaults(db, {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        visibility: input.visibility,
        creatorProfileId: profile.id,
      });
      return { space: serializeSpace(space, "owner", 1, false) };
    },
  );

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/api/spaces", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = await findOwnProfile(db, userId);
    const query = paginationQuerySchema.parse(request.query);
    const page = await listSpacesForViewer(db, profile?.id ?? null, query.cursor, query.limit);
    const spaceIds = page.items.map((row) => row.id);
    const memberCounts = await countSpaceMembersBatch(db, spaceIds);
    const unreadSpaceIds = profile
      ? await findSpacesWithUnread(db, profile.id, spaceIds)
      : new Set<string>();
    return {
      items: page.items.map((row) =>
        serializeSpace(row, row.role, memberCounts.get(row.id) ?? 0, unreadSpaceIds.has(row.id)),
      ),
      nextCursor: page.nextCursor,
    };
  });

  // Public : un visiteur arrive sur l'espace public qui a le plus de messages
  // sur les sept derniers jours.
  app.get(
    "/api/spaces/most-active",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async () => {
      const since = new Date(Date.now() - MOST_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      return { spaceId: await findMostActivePublicSpaceId(db, since) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/spaces/:id", async (request) => {
    const userId = await getSessionUserId(auth, request);
    const profile = await findOwnProfile(db, userId);
    const { space, membership } = await requireVisibleSpace(
      db,
      request.params.id,
      profile?.id ?? null,
    );
    const memberCount = await countSpaceMembers(db, space.id);
    const hasUnread = profile
      ? (await findSpacesWithUnread(db, profile.id, [space.id])).has(space.id)
      : false;
    return { space: serializeSpace(space, membership?.role ?? null, memberCount, hasUnread) };
  });

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/spaces/:id/members",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      await requireVisibleSpace(db, request.params.id, profile.id);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listSpaceMembers(db, request.params.id, query.cursor, query.limit);
      return { items: page.items.map(serializeSpaceMember), nextCursor: page.nextCursor };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/spaces/:id/members",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { space, membership } = await requireVisibleSpace(db, request.params.id, profile.id);
      requireAdmin(membership);
      requireWritableSpace(space);
      const input = addSpaceMemberSchema.parse(request.body);
      const target = await findProfileByHandle(db, input.handle);
      if (!target || target.deletedAt) throw notFound("Ce profil n'existe pas.");
      const existingMembership = await findSpaceMembership(db, request.params.id, target.id);
      if (existingMembership) throw conflict("Ce profil est déjà membre de l'espace.");
      await addSpaceMember(db, request.params.id, target.id, "member");
      return { added: true };
    },
  );

  // Rejoindre soi-même un espace public. Un espace privé se rejoint par
  // invitation ou par un administrateur, jamais par cette route.
  app.post<{ Params: { id: string } }>(
    "/api/spaces/:id/join",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { space } = await requireVisibleSpace(db, request.params.id, profile.id);
      if (space.visibility !== "public" || space.kind !== "community")
        throw notFound("Cet espace n'existe pas.");
      requireWritableSpace(space);
      await addSpaceMember(db, space.id, profile.id, "member");
      return { joined: true };
    },
  );

  app.delete<{ Params: { id: string; profileId: string } }>(
    "/api/spaces/:id/members/:profileId",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { membership } = await requireVisibleSpace(db, request.params.id, profile.id);
      const isSelf = profile.id === request.params.profileId;
      if (isSelf) {
        await leaveSpace(db, request.params.id, profile.id);
      } else {
        requireAdmin(membership);
        const target = await findSpaceMembership(db, request.params.id, request.params.profileId);
        if (target?.role === "owner")
          throw forbidden("Le propriétaire de l'espace ne peut pas être retiré.");
        await removeSpaceMember(db, request.params.id, request.params.profileId);
      }
      await chat.publish({
        type: "member:removed",
        spaceId: request.params.id,
        profileId: request.params.profileId,
      });
      return { removed: true };
    },
  );
}
