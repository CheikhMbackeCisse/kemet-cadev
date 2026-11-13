import type { FastifyInstance } from "fastify";
import { PEOPLE_SEARCH_LIMIT, SPACE_SEARCH_LIMIT, searchQuerySchema } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest } from "../../errors.js";
import { searchPeopleToWrite } from "../repositories/people-search.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { searchPublicSpaces } from "../repositories/space-search.js";
import { serializeSpace } from "../chat-serializers.js";
import { serializeProfileSummary } from "../serializers.js";
import type { AppDeps } from "../app.js";

export function registerSearchRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  // Public, comme la liste des espaces : un visiteur cherche aussi un espace.
  app.get(
    "/api/spaces/search",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await getSessionUserId(auth, request);
      const profile = userId ? await findProfileByUserId(db, userId) : null;
      const { q } = searchQuerySchema.parse(request.query);
      const hits = await searchPublicSpaces(db, profile?.id ?? null, q, SPACE_SEARCH_LIMIT);
      return {
        items: hits.map((hit) => serializeSpace(hit.space, hit.role, hit.memberCount, false)),
      };
    },
  );

  app.get(
    "/api/people/search",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw badRequest("Complétez votre profil avant d'écrire à quelqu'un.");
      const { q } = searchQuerySchema.parse(request.query);
      const rows = await searchPeopleToWrite(db, profile.id, q, PEOPLE_SEARCH_LIMIT);
      return { items: rows.map(serializeProfileSummary) };
    },
  );
}
