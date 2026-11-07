import type { FastifyInstance } from "fastify";
import { updateOnboardingSchema, type OnboardingState } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden } from "../../errors.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { knownInterests, suggestPeople, suggestSpaces, updateOnboarding } from "../repositories/onboarding.js";
import { computeProfilesPoints } from "../repositories/points.js";
import { countSpaceMembersBatch } from "../repositories/chat.js";
import { serializeSpace } from "../chat-serializers.js";
import { serializeProfileSummary } from "../serializers.js";
import type { AppDeps } from "../app.js";
import type { profiles } from "@kemet/db";

type ProfileRow = typeof profiles.$inferSelect;

export function serializeOnboarding(row: ProfileRow): OnboardingState {
  return {
    step: row.onboardingStep,
    completed: row.onboardingCompletedAt !== null,
    interests: knownInterests(row.interests),
  };
}

async function requireOwnProfile(db: AppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complète ton profil avant de continuer.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

// Toujours le profil de la session : aucune route ne lit ni n'écrit
// l'onboarding d'une autre personne.
export function registerOnboardingRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  app.patch(
    "/api/me/onboarding",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = updateOnboardingSchema.parse(request.body);
      const updated = await updateOnboarding(db, profile.id, input);
      return { onboarding: serializeOnboarding(updated) };
    },
  );

  // Chaque suggestion parcourt tous les espaces ou tous les profils.
  const suggestionLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  app.get("/api/me/onboarding/spaces", suggestionLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const suggestions = await suggestSpaces(db, profile.id, knownInterests(profile.interests));
    const memberCounts = await countSpaceMembersBatch(
      db,
      suggestions.map((row) => row.space.id),
    );
    return {
      items: suggestions.map((row) =>
        serializeSpace(row.space, row.role, memberCounts.get(row.space.id) ?? 0, false),
      ),
    };
  });

  app.get("/api/me/onboarding/people", suggestionLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const suggestions = await suggestPeople(db, profile);
    const points = await computeProfilesPoints(
      db,
      suggestions.map((row) => row.profile.id),
    );
    return {
      items: suggestions.map((row) => ({
        profile: serializeProfileSummary(row.profile),
        level: points.get(row.profile.id)?.level ?? "apprenti",
        isFollowed: row.isFollowed,
      })),
    };
  });
}
