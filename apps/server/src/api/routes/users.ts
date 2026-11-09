import type { FastifyInstance } from "fastify";
import { paginationQuerySchema } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import {
  countFollowers,
  countFollowing,
  createFollow,
  deleteFollow,
  findProfileByHandle,
  findProfileByUserId,
  isFollowing,
  listCredentials,
  listFollowers,
  listFollowing,
  countHiddenFollows,
} from "../repositories/profiles.js";
import { computeProfilePoints } from "../repositories/points.js";
import { serializeCredential, serializeProfile, serializeProfileSummary } from "../serializers.js";
import type { AppDeps } from "../app.js";

async function requireProfileByHandle(db: AppDeps["db"], handle: string) {
  const profile = await findProfileByHandle(db, handle);
  if (!profile || profile.deletedAt) throw notFound("Ce profil n'existe pas.");
  return profile;
}

export function registerUserRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  app.get<{ Params: { handle: string } }>("/api/users/:handle", async (request) => {
    const profile = await requireProfileByHandle(db, request.params.handle);
    const viewerId = await getSessionUserId(auth, request);
    const viewerProfile = viewerId ? await findProfileByUserId(db, viewerId) : null;
    const credentials = await listCredentials(db, profile.id);
    const { level } = await computeProfilePoints(db, profile.id);
    return {
      profile: serializeProfile(profile, level),
      credentials: credentials.map(serializeCredential),
      followerCount: await countFollowers(db, profile.id),
      followingCount: await countFollowing(db, profile.id),
      isFollowedByViewer: viewerProfile ? await isFollowing(db, viewerProfile.id, profile.id) : null,
    };
  });

  app.post<{ Params: { handle: string } }>(
    "/api/users/:handle/follow",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const target = await requireProfileByHandle(db, request.params.handle);
      const follower = await requireOwnProfile(db, userId);
      if (follower.id === target.id) throw badRequest("Impossible de se suivre soi-même.");
      await createFollow(db, follower.id, target.id);
      return { following: true };
    },
  );

  app.delete<{ Params: { handle: string } }>(
    "/api/users/:handle/follow",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const target = await requireProfileByHandle(db, request.params.handle);
      const follower = await requireOwnProfile(db, userId);
      await deleteFollow(db, follower.id, target.id);
      return { following: false };
    },
  );

  app.get<{ Params: { handle: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/users/:handle/followers",
    async (request) => {
      const profile = await requireProfileByHandle(db, request.params.handle);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listFollowers(db, profile.id, query.cursor, query.limit);
      return {
        items: page.items.map(serializeProfileSummary),
        nextCursor: page.nextCursor,
        hiddenCount: await countHiddenFollows(db, profile.id, "followers"),
      };
    },
  );

  app.get<{ Params: { handle: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/users/:handle/following",
    async (request) => {
      const profile = await requireProfileByHandle(db, request.params.handle);
      const query = paginationQuerySchema.parse(request.query);
      const page = await listFollowing(db, profile.id, query.cursor, query.limit);
      return {
        items: page.items.map(serializeProfileSummary),
        nextCursor: page.nextCursor,
        hiddenCount: await countHiddenFollows(db, profile.id, "following"),
      };
    },
  );
}

async function requireOwnProfile(db: AppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de suivre quelqu'un.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}
