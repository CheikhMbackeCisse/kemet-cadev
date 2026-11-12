import type { FastifyInstance } from "fastify";
import { ORGANIZATION_SUGGESTIONS_LIMIT, organizationSuggestionsQuerySchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { listOrganizationSuggestions } from "../repositories/organizations.js";
import type { AppDeps } from "../app.js";

export function registerOrganizationRoutes(app: FastifyInstance, { db, auth }: AppDeps): void {
  app.get(
    "/api/organizations",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request) => {
      await requireSessionUserId(auth, request);
      const query = organizationSuggestionsQuerySchema.parse(request.query);
      const items = await listOrganizationSuggestions(
        db,
        query.kind,
        query.q,
        ORGANIZATION_SUGGESTIONS_LIMIT,
      );
      return { items };
    },
  );
}
