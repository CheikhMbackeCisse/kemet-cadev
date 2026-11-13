import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { applications, helpRequests, profiles, projects, type Db, type DbOrTx } from "@kemet/db";
import type { CreateHelpRequestInput, CreateProjectInput, UpdateProjectInput } from "@kemet/shared";
import { notWrittenByFiller } from "./fillers.js";

// Un projet entre dans le fil quand il est publié ou qu'il ouvre une demande
// d'aide, et y reste le temps de cette fenêtre.
const FEED_PROJECT_WINDOW_DAYS = 30;
export const FEED_PROJECT_ROLES = 3;

function toPage<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function findProjectBySlug(db: Db, slug: string) {
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug));
  return project ?? null;
}

export async function findProjectById(db: DbOrTx, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  return project ?? null;
}

export async function createProject(db: Db, ownerId: string, input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({
      ownerId,
      slug: input.slug,
      name: input.name,
      pitch: input.pitch,
      description: input.description,
      repoUrl: input.repoUrl,
      demoUrl: input.demoUrl ?? null,
      stack: input.stack,
    })
    .returning();
  return project!;
}

export async function updateProject(db: Db, projectId: string, input: UpdateProjectInput) {
  const [project] = await db
    .update(projects)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.pitch !== undefined ? { pitch: input.pitch } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.repoUrl !== undefined ? { repoUrl: input.repoUrl } : {}),
      ...(input.demoUrl !== undefined ? { demoUrl: input.demoUrl } : {}),
      ...(input.stack !== undefined ? { stack: input.stack } : {}),
    })
    .where(eq(projects.id, projectId))
    .returning();
  return project!;
}

export async function softDeleteProject(db: Db, projectId: string) {
  await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, projectId));
}

export async function listProjects(db: Db, cursor: string | undefined, limit: number) {
  const visible = isNull(projects.deletedAt);
  const condition = cursor ? and(visible, lt(projects.createdAt, new Date(cursor))) : visible;
  const rows = await db.select().from(projects).where(condition).orderBy(desc(projects.createdAt)).limit(limit + 1);
  return toPage(rows, limit);
}

export async function countOpenHelpRequests(db: DbOrTx, projectId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(helpRequests)
    .where(and(eq(helpRequests.projectId, projectId), eq(helpRequests.status, "open")));
  return row?.value ?? 0;
}

export async function insertHelpRequest(
  db: Db,
  input: { projectId: string; authorId: string; kind: CreateHelpRequestInput["kind"]; title: string; description: string; stack: string[] },
) {
  const [helpRequest] = await db.insert(helpRequests).values(input).returning();
  return helpRequest!;
}

export async function findHelpRequestById(db: Db, helpRequestId: string) {
  const [helpRequest] = await db.select().from(helpRequests).where(eq(helpRequests.id, helpRequestId));
  return helpRequest ?? null;
}

export async function listHelpRequestsForProject(db: Db, projectId: string) {
  return db.select().from(helpRequests).where(eq(helpRequests.projectId, projectId)).orderBy(desc(helpRequests.createdAt));
}

export async function closeHelpRequest(db: DbOrTx, helpRequestId: string) {
  const [helpRequest] = await db
    .update(helpRequests)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(helpRequests.id, helpRequestId))
    .returning();
  return helpRequest!;
}

export async function countApplications(db: DbOrTx, helpRequestId: string) {
  const [row] = await db.select({ value: count() }).from(applications).where(eq(applications.helpRequestId, helpRequestId));
  return row?.value ?? 0;
}

/** `null` si l'index unique a rejeté l'insertion : une candidature par personne et par demande. */
export async function insertApplication(db: Db, input: { helpRequestId: string; applicantId: string; message: string }) {
  const [application] = await db
    .insert(applications)
    .values(input)
    .onConflictDoNothing({ target: [applications.helpRequestId, applications.applicantId] })
    .returning();
  return application ?? null;
}

export async function findApplicationById(db: Db, applicationId: string) {
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId));
  return application ?? null;
}

export async function listApplicationsForHelpRequest(db: Db, helpRequestId: string) {
  return db
    .select({ application: applications, applicant: profiles })
    .from(applications)
    .innerJoin(profiles, eq(profiles.id, applications.applicantId))
    .where(eq(applications.helpRequestId, helpRequestId))
    .orderBy(desc(applications.createdAt));
}

/**
 * Accepter une candidature ferme la demande et refuse les autres en
 * attente, dans une transaction : jamais deux candidatures acceptées.
 */
export async function decideApplication(db: Db, applicationId: string, accepted: boolean) {
  return db.transaction(async (tx) => {
    const [application] = await tx
      .update(applications)
      .set({ status: accepted ? "accepted" : "declined", decidedAt: new Date() })
      .where(eq(applications.id, applicationId))
      .returning();
    if (!application) return null;
    if (accepted) {
      await tx
        .update(applications)
        .set({ status: "declined", decidedAt: new Date() })
        .where(and(eq(applications.helpRequestId, application.helpRequestId), eq(applications.status, "pending")));
      await closeHelpRequest(tx, application.helpRequestId);
    }
    return application;
  });
}

/**
 * Projets à montrer dans le fil, classés comme les posts "Pour toi" : un
 * score (demandes ouvertes, candidatures reçues), puis la date de la dernière
 * activité (publication ou nouvelle demande). `ownerIds` restreint aux
 * projets de ces personnes (onglet Abonnements).
 */
export async function listFeedProjects(db: Db, ownerIds: string[] | null, limit: number) {
  if (ownerIds !== null && ownerIds.length === 0) return [];
  const since = new Date(Date.now() - FEED_PROJECT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Colonnes écrites en toutes lettres : voir la remarque de listPourToiFeed (posts.ts).
  const lastOpenRequestAt = sql`(select max("help_requests"."created_at") from "help_requests"
    where "help_requests"."project_id" = "projects"."id" and "help_requests"."status" = 'open')`;
  const activityAt = sql<Date>`greatest("projects"."created_at", coalesce(${lastOpenRequestAt}, "projects"."created_at"))`;
  const score = sql<number>`(
    (select count(*) from "help_requests" where "help_requests"."project_id" = "projects"."id" and "help_requests"."status" = 'open') * 3 +
    (select count(*) from "applications" inner join "help_requests" on "help_requests"."id" = "applications"."help_request_id"
      where "help_requests"."project_id" = "projects"."id" and "help_requests"."status" = 'open')
  )`;
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        notWrittenByFiller(projects.ownerId),
        // Date passée en texte : comparée à une expression SQL brute, le
        // pilote ne sait pas la convertir.
        sql`${activityAt} > ${since.toISOString()}`,
        ...(ownerIds ? [inArray(projects.ownerId, ownerIds)] : []),
      ),
    )
    .orderBy(desc(score), desc(activityAt))
    .limit(limit);
  return rows.map((row) => row.project);
}

/** Demandes ouvertes d'un projet, les plus récentes d'abord : les rôles recherchés de sa carte. */
export async function listOpenRoles(db: Db, projectId: string, limit: number) {
  return db
    .select({ id: helpRequests.id, title: helpRequests.title, kind: helpRequests.kind })
    .from(helpRequests)
    .where(and(eq(helpRequests.projectId, projectId), eq(helpRequests.status, "open")))
    .orderBy(desc(helpRequests.createdAt))
    .limit(limit);
}
