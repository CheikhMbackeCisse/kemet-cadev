import type { FastifyInstance } from "fastify";
import {
  createApplicationSchema,
  createHelpRequestSchema,
  createProjectSchema,
  decideApplicationSchema,
  paginationQuerySchema,
  updateProjectSchema,
} from "@kemet/shared";
import { loadProjectsConfig, type ProjectsConfig } from "../../config/projects-config.js";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  closeHelpRequest,
  countApplications,
  countOpenHelpRequests,
  createProject,
  decideApplication,
  findApplicationById,
  findHelpRequestById,
  findProjectById,
  findProjectBySlug,
  insertApplication,
  insertHelpRequest,
  listApplicationsForHelpRequest,
  listHelpRequestsForProject,
  listProjects,
  softDeleteProject,
  updateProject,
} from "../repositories/projects.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { findProfileById } from "../repositories/chat.js";
import { awardPoints, POINTS_PROJECT_HELP_CONFIRMED } from "../repositories/points.js";
import {
  serializeApplication,
  serializeHelpRequest,
  serializeProjectDetail,
  serializeProjectSummary,
} from "../project-serializers.js";
import type { ChatAppDeps } from "../app.js";

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier un projet.");
  return profile;
}

export function registerProjectRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  const projectsConfig: ProjectsConfig = loadProjectsConfig();

  async function toProjectSummary(row: Awaited<ReturnType<typeof findProjectBySlug>> & object) {
    const [owner, openHelpRequestCount] = await Promise.all([
      findProfileById(db, row.ownerId),
      countOpenHelpRequests(db, row.id),
    ]);
    return serializeProjectSummary(row, owner!, openHelpRequestCount);
  }

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/api/projects", async (request) => {
    await requireSessionUserId(auth, request);
    const query = paginationQuerySchema.parse(request.query);
    const page = await listProjects(db, query.cursor, query.limit);
    const items = await Promise.all(page.items.map((row) => toProjectSummary(row)));
    return { items, nextCursor: page.nextCursor };
  });

  app.post("/api/projects", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const input = createProjectSchema.parse(request.body);
    const existing = await findProjectBySlug(db, input.slug);
    if (existing) throw conflict("Un projet avec cet identifiant existe déjà.");
    const project = await createProject(db, profile.id, input);
    return { project: serializeProjectDetail(project, profile, 0, projectsConfig.datacloudReferralUrl) };
  });

  app.get<{ Params: { slug: string } }>("/api/projects/:slug", async (request) => {
    await requireSessionUserId(auth, request);
    const project = await findProjectBySlug(db, request.params.slug);
    if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
    const [owner, openHelpRequestCount] = await Promise.all([
      findProfileById(db, project.ownerId),
      countOpenHelpRequests(db, project.id),
    ]);
    return { project: serializeProjectDetail(project, owner!, openHelpRequestCount, projectsConfig.datacloudReferralUrl) };
  });

  app.patch<{ Params: { slug: string } }>(
    "/api/projects/:slug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const project = await findProjectBySlug(db, request.params.slug);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire peut modifier ce projet.");
      const input = updateProjectSchema.parse(request.body);
      const updated = await updateProject(db, project.id, input);
      const openHelpRequestCount = await countOpenHelpRequests(db, project.id);
      return { project: serializeProjectDetail(updated, profile, openHelpRequestCount, projectsConfig.datacloudReferralUrl) };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    "/api/projects/:slug",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const project = await findProjectBySlug(db, request.params.slug);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire peut supprimer ce projet.");
      await softDeleteProject(db, project.id);
      return { deleted: true };
    },
  );

  app.get<{ Params: { slug: string } }>("/api/projects/:slug/help-requests", async (request) => {
    await requireSessionUserId(auth, request);
    const project = await findProjectBySlug(db, request.params.slug);
    if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
    const rows = await listHelpRequestsForProject(db, project.id);
    const items = await Promise.all(
      rows.map(async (row) => serializeHelpRequest(row, await countApplications(db, row.id))),
    );
    return { items };
  });

  app.post<{ Params: { slug: string } }>(
    "/api/projects/:slug/help-requests",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const project = await findProjectBySlug(db, request.params.slug);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire du projet peut publier une demande.");
      const input = createHelpRequestSchema.parse(request.body);
      const helpRequest = await insertHelpRequest(db, {
        projectId: project.id,
        authorId: profile.id,
        kind: input.kind,
        title: input.title,
        description: input.description,
        stack: input.stack,
      });
      return { helpRequest: serializeHelpRequest(helpRequest, 0) };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/help-requests/:id/close",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const helpRequest = await findHelpRequestById(db, request.params.id);
      if (!helpRequest) throw notFound("Cette demande n'existe pas.");
      const project = await findProjectById(db, helpRequest.projectId);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire du projet peut fermer cette demande.");
      if (helpRequest.status === "closed") throw conflict("Cette demande est déjà fermée.");
      const closed = await closeHelpRequest(db, helpRequest.id);
      return { helpRequest: serializeHelpRequest(closed, await countApplications(db, closed.id)) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/help-requests/:id/applications", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const helpRequest = await findHelpRequestById(db, request.params.id);
    if (!helpRequest) throw notFound("Cette demande n'existe pas.");
    const project = await findProjectById(db, helpRequest.projectId);
    if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
    // Les candidatures restent privées entre le candidat et le propriétaire
    // du projet, comme un dossier de candidature classique : personne
    // d'autre ne doit voir qui a postulé ni leur message.
    if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire du projet peut voir ces candidatures.");
    const rows = await listApplicationsForHelpRequest(db, helpRequest.id);
    return { items: rows.map((row) => serializeApplication(row.application, row.applicant)) };
  });

  app.post<{ Params: { id: string } }>(
    "/api/help-requests/:id/applications",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const helpRequest = await findHelpRequestById(db, request.params.id);
      if (!helpRequest) throw notFound("Cette demande n'existe pas.");
      const project = await findProjectById(db, helpRequest.projectId);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (helpRequest.status === "closed") throw badRequest("Cette demande n'accepte plus de candidatures.");
      if (helpRequest.authorId === profile.id) throw badRequest("Le propriétaire du projet ne peut pas postuler à sa propre demande.");
      const input = createApplicationSchema.parse(request.body);
      const application = await insertApplication(db, { helpRequestId: helpRequest.id, applicantId: profile.id, message: input.message });
      if (!application) throw conflict("Vous avez déjà postulé à cette demande.");
      return { application: serializeApplication(application, profile) };
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/applications/:id/decision",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const application = await findApplicationById(db, request.params.id);
      if (!application) throw notFound("Cette candidature n'existe pas.");
      const helpRequest = await findHelpRequestById(db, application.helpRequestId);
      if (!helpRequest) throw notFound("Cette demande n'existe pas.");
      const project = await findProjectById(db, helpRequest.projectId);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id) throw forbidden("Seul le propriétaire du projet peut décider de cette candidature.");
      if (application.status !== "pending") throw conflict("Cette candidature a déjà reçu une décision.");
      const input = decideApplicationSchema.parse(request.body);
      const decided = await decideApplication(db, application.id, input.accepted);
      if (!decided) throw notFound("Cette candidature n'existe pas.");
      if (decided.status === "accepted") {
        await awardPoints(db, {
          profileId: decided.applicantId,
          source: "project_help_confirmed",
          sourceId: decided.id,
          amount: POINTS_PROJECT_HELP_CONFIRMED,
          givenByProfileId: profile.id,
        });
      }
      const applicantProfile = await findProfileById(db, decided.applicantId);
      return { application: serializeApplication(decided, applicantProfile!) };
    },
  );
}
