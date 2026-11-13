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
import {
  canActForAuthor,
  findManagedOrganization,
  findOrganizationContact,
} from "../repositories/organization-accounts.js";
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
    const contact =
      row.author.kind === "organization"
        ? await findOrganizationContact(db, row.author.id, row.opportunity.publishedById)
        : row.author.userId
          ? row.author
          : null;
    return serializeOpportunityDetail(
      row,
      levels.get(row.author.id)!,
      contact?.handle ?? null,
      todayIsoDate(),
    );
  }

  async function requireOwnOpportunity(userId: string, slug: string) {
    const profile = await requireOwnProfile(db, userId);
    const found = await findOpportunityBySlug(db, slug);
    if (!found) throw notFound("Cette offre n'existe pas.");
    if (!(await canActForAuthor(db, profile.id, found.opportunity.authorId)))
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
      const { slug, asOrganizationId, ...input } = createOpportunitySchema.parse(request.body);
      const organization = asOrganizationId
        ? await findManagedOrganization(db, profile.id, asOrganizationId)
        : null;
      if (asOrganizationId && !organization) throw forbidden("Tu ne gères pas cette organisation.");
      const author = organization ?? profile;
      const created = await insertOpportunity(
        db,
        author.id,
        slug,
        // Au nom d'une organisation, l'offre porte son nom tel qu'il est référencé.
        organization ? { ...input, organization: organization.displayName } : input,
        organization ? profile.id : null,
      );
      if (!created) throw conflict("Une offre avec cet identifiant existe déjà.");
      return { opportunity: await presentDetail({ opportunity: created, author }) };
    },
  );

  app.put("/api/opportunities/:slug", writeLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const { slug } = slugParamsSchema.parse(request.params);
    const { opportunity, author } = await requireOwnOpportunity(userId, slug);
    const parsed = opportunityInputSchema.parse(request.body);
    const input =
      author.kind === "organization" ? { ...parsed, organization: author.displayName } : parsed;
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
