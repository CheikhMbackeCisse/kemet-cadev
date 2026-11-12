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
  listOpenToOpportunityCandidates,
} from "../repositories/profiles.js";
import { computeProfilePoints, computeProfilesPoints } from "../repositories/points.js";
import { countProfileWorks } from "../repositories/works.js";
import { serializeCredential, serializeProfile, serializeProfileSummary } from "../serializers.js";
import type { AppDeps } from "../app.js";

async function requireProfileByHandle(db: AppDeps["db"], handle: string) {
  const profile = await findProfileByHandle(db, handle);
  if (!profile || profile.deletedAt) throw notFound("Ce profil n'existe pas.");
  return profile;
}

const OPEN_PROFILE_CARDS = 6;

export function registerUserRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  // Cartes du fil "Pour toi" d'un compte RH ou entrepreneur, lisibles par tous.
  app.get("/api/feed/open-profiles", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const viewerId = await getSessionUserId(auth, request);
    const viewer = viewerId ? await findProfileByUserId(db, viewerId) : null;
    const candidates = await listOpenToOpportunityCandidates(db, viewer?.id ?? null, OPEN_PROFILE_CARDS * 4);
    const points = await computeProfilesPoints(db, candidates.map((row) => row.id));
    const items = candidates
      .map((row) => serializeProfile(row, points.get(row.id)!.level))
      .filter((profile) => profile.openToOpportunities)
      .slice(0, OPEN_PROFILE_CARDS);
    return { items };
  });

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
      workCount: await countProfileWorks(db, profile.id),
      isFollowedByViewer: viewerProfile ? await isFollowing(db, viewerProfile.id, profile.id) : null,
      acceptsMessages: profile.userId !== null && profile.deletedAt === null,
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
