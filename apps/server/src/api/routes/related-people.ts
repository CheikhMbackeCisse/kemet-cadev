import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { RelatedPeople } from "@kemet/shared";
import { workAuthors, type Db } from "@kemet/db";
import { notFound } from "../../errors.js";
import { computeLevels } from "../repositories/points.js";
import { findProjectBySlug } from "../repositories/projects.js";
import { findRelatedPeople, type RelatedPeopleQuery } from "../repositories/related-people.js";
import { findWorkBySlug } from "../repositories/works.js";
import { serializeWorkPerson } from "../work-serializers.js";
import type { ChatAppDeps } from "../app.js";

const publicReadLimit = { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } };
const paramsSchema = z.object({ slug: z.string().min(1).max(80) });

async function acceptedCoauthorIds(db: Db, workId: string): Promise<string[]> {
  const rows = await db
    .select({ profileId: workAuthors.profileId })
    .from(workAuthors)
    .where(and(eq(workAuthors.workId, workId), eq(workAuthors.status, "accepted")));
  return rows.map((row) => row.profileId);
}

async function relatedPeople(db: Db, query: RelatedPeopleQuery): Promise<RelatedPeople> {
  const { total, people } = await findRelatedPeople(db, query);
  const levels = await computeLevels(
    db,
    people.map((person) => person.id),
  );
  return {
    total,
    people: people.map((person) =>
      serializeWorkPerson(person, levels.get(person.id) ?? "apprenti"),
    ),
  };
}

/**
 * "Qui a travaillé sur ce sujet ?" en lecture seule, ouvert sans compte :
 * tags communs seulement, jamais l'assistant (son appel reste réservé à
 * `POST /api/work-matches`, avec session et quota).
 */
export function registerRelatedPeopleRoutes(app: FastifyInstance, { db }: ChatAppDeps): void {
  app.get<{ Params: { slug: string } }>(
    "/api/works/:slug/related-people",
    publicReadLimit,
    async (request) => {
      const { slug } = paramsSchema.parse(request.params);
      const work = await findWorkBySlug(db, slug);
      if (!work || work.deletedAt) throw notFound("Ce travail n'existe pas.");
      return {
        related: await relatedPeople(db, {
          terms: [...work.tags, ...work.stack],
          excludeWorkId: work.id,
          excludeProfileIds: [work.publisherId, ...(await acceptedCoauthorIds(db, work.id))],
        }),
      };
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/projects/:slug/related-people",
    publicReadLimit,
    async (request) => {
      const { slug } = paramsSchema.parse(request.params);
      const project = await findProjectBySlug(db, slug);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      return {
        related: await relatedPeople(db, {
          terms: project.stack,
          excludeWorkId: null,
          excludeProfileIds: [project.ownerId],
        }),
      };
    },
  );
}
