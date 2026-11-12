import type { FastifyInstance } from "fastify";
import {
  createOpportunitySchema,
  listOpportunitiesQuerySchema,
  opportunityInputSchema,
  todayIsoDate,
} from "@kemet/shared";
import { z } from "zod";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import {
  findOpportunityBySlug,
  insertOpportunity,
  listOpportunities,
  softDeleteOpportunity,
  updateOpportunity,
  type OpportunityWithAuthor,
} from "../repositories/opportunities.js";
import { computeLevels } from "../repositories/points.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import {
  serializeOpportunityDetail,
  serializeOpportunitySummary,
} from "../opportunity-serializers.js";
import type { ChatAppDeps } from "../app.js";

const MAX_OPPORTUNITIES_PER_MINUTE = 10;
const slugParamsSchema = z.object({ slug: z.string().min(1).max(60) });

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complète ton profil avant de publier une offre.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

export function registerOpportunityRoutes(
  app: FastifyInstance,
  { db, auth, antiSpamConfig }: ChatAppDeps,
): void {
  // Lectures publiques : une offre se lit sans compte, la limite est la seule borne.
  const publicReadLimit = { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } };
  const writeLimit = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  async function presentDetail(row: OpportunityWithAuthor) {
    const levels = await computeLevels(db, [row.author.id]);
    return serializeOpportunityDetail(row, levels.get(row.author.id)!, todayIsoDate());
  }

  async function requireOwnOpportunity(userId: string, slug: string) {
    const profile = await requireOwnProfile(db, userId);
    const found = await findOpportunityBySlug(db, slug);
    if (!found) throw notFound("Cette offre n'existe pas.");
    if (found.opportunity.authorId !== profile.id)
      throw forbidden("Seul l'auteur peut modifier cette offre.");
    return found;
  }

  app.get("/api/opportunities", publicReadLimit, async (request) => {
    const query = listOpportunitiesQuerySchema.parse(request.query);
    const today = todayIsoDate();
    const page = await listOpportunities(db, query, today);
    return {
      items: page.items.map((row) => serializeOpportunitySummary(row, today)),
      nextCursor: page.nextCursor,
    };
  });

  app.get("/api/opportunities/:slug", publicReadLimit, async (request) => {
    const { slug } = slugParamsSchema.parse(request.params);
    const found = await findOpportunityBySlug(db, slug);
    if (!found) throw notFound("Cette offre n'existe pas.");
    return { opportunity: await presentDetail(found) };
  });

  app.post(
    "/api/opportunities",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_OPPORTUNITIES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { slug, ...input } = createOpportunitySchema.parse(request.body);
      const created = await insertOpportunity(db, profile.id, slug, input);
      if (!created) throw conflict("Une offre avec cet identifiant existe déjà.");
      return { opportunity: await presentDetail({ opportunity: created, author: profile }) };
    },
  );

  app.put("/api/opportunities/:slug", writeLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const { slug } = slugParamsSchema.parse(request.params);
    const { opportunity, author } = await requireOwnOpportunity(userId, slug);
    const input = opportunityInputSchema.parse(request.body);
    const updated = await updateOpportunity(db, opportunity.id, input);
    return { opportunity: await presentDetail({ opportunity: updated, author }) };
  });

  app.delete("/api/opportunities/:slug", writeLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const { slug } = slugParamsSchema.parse(request.params);
    const { opportunity } = await requireOwnOpportunity(userId, slug);
    await softDeleteOpportunity(db, opportunity.id);
    return { deleted: true };
  });
}
