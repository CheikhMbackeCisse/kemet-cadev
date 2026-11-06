import type { FastifyInstance } from "fastify";
import { workMatchRequestSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden } from "../../errors.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import type { ChatAppDeps } from "../app.js";

const MAX_WORK_MATCHES_PER_MINUTE = 6;

export function registerWorkMatchRoutes(
  app: FastifyInstance,
  { db, auth, antiSpamConfig, workMatcher }: ChatAppDeps,
): void {
  // Déclenché seulement par un bouton : jamais appelé au chargement d'une page.
  app.post(
    "/api/work-matches",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_WORK_MATCHES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw badRequest("Complétez votre profil avant d'interroger l'assistant.");
      if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
      const input = workMatchRequestSchema.parse(request.body);
      return { result: await workMatcher.match(input.subject, profile) };
    },
  );
}
