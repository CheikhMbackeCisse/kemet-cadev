import type { FastifyInstance } from "fastify";
import { addSpaceMemberSchema, createSpaceSchema, paginationQuerySchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  addSpaceMember,
  createSpaceWithDefaults,
  findSpaceById,
  findSpaceBySlug,
  findSpaceMembership,
  listSpaceMembers,
  listSpacesForViewer,
  removeSpaceMember,
} from "../repositories/chat.js";
import { findProfileByHandle, findProfileByUserId } from "../repositories/profiles.js";
import { serializeSpace, serializeSpaceMember } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de créer ou rejoindre un espace.");
  return profile;
}

async function requireVisibleSpace(db: ChatAppDeps["db"], spaceId: string, profileId: string) {
  const space = await findSpaceById(db, spaceId);
  if (!space) throw notFound("Cet espace n'existe pas.");
  const membership = await findSpaceMembership(db, spaceId, profileId);
  if (space.visibility === "private" && !membership) throw notFound("Cet espace n'existe pas.");
  return { space, membership };
}

function requireAdmin(membership: { role: string } | null) {
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw forbidden("Seuls les administrateurs de l'espace peuvent faire cette action.");
  }
}

export function registerSpaceRoutes(app: FastifyInstance, { db, auth, chat }: ChatAppDeps): void {
  app.post("/api/spaces", async (request) => {
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
    return { space: serializeSpace(space, "owner") };
  });

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/api/spaces", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const query = paginationQuerySchema.parse(request.query);
    const page = await listSpacesForViewer(db, profile.id, query.cursor, query.limit);
    return {
      items: page.items.map((row) => serializeSpace(row, row.role)),
      nextCursor: page.nextCursor,
    };
  });

  app.get<{ Params: { id: string } }>("/api/spaces/:id", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const { space, membership } = await requireVisibleSpace(db, request.params.id, profile.id);
    return { space: serializeSpace(space, membership?.role ?? null) };
  });

  app.get<{ Params: { id: string } }>("/api/spaces/:id/members", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    await requireVisibleSpace(db, request.params.id, profile.id);
    const members = await listSpaceMembers(db, request.params.id);
    return { items: members.map(serializeSpaceMember) };
  });

  app.post<{ Params: { id: string } }>("/api/spaces/:id/members", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const { membership } = await requireVisibleSpace(db, request.params.id, profile.id);
    requireAdmin(membership);
    const input = addSpaceMemberSchema.parse(request.body);
    const target = await findProfileByHandle(db, input.handle);
    if (!target) throw notFound("Ce profil n'existe pas.");
    const existingMembership = await findSpaceMembership(db, request.params.id, target.id);
    if (existingMembership) throw conflict("Ce profil est déjà membre de l'espace.");
    await addSpaceMember(db, request.params.id, target.id, "member");
    return { added: true };
  });

  app.delete<{ Params: { id: string; profileId: string } }>(
    "/api/spaces/:id/members/:profileId",
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { membership } = await requireVisibleSpace(db, request.params.id, profile.id);
      const isSelf = profile.id === request.params.profileId;
      if (!isSelf) requireAdmin(membership);
      await removeSpaceMember(db, request.params.id, request.params.profileId);
      await chat.publish({ type: "member:removed", spaceId: request.params.id, profileId: request.params.profileId });
      return { removed: true };
    },
  );
}
