import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createCompetitionRequestSchema,
  createSubmissionSchema,
  createTeamSchema,
  juryScoreInputSchema,
  paginationQuerySchema,
  reviewCompetitionSchema,
  updateSubmissionSchema,
} from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  castVote,
  computeCompetitionPhase,
  computeStandings,
  countSubmissions,
  countTeams,
  createCompetitionRequest,
  createSubmission,
  createTeam,
  findCompetitionById,
  findCompetitionBySlug,
  findSubmissionByTeamId,
  findSubmissionById,
  findTeamById,
  findTeamForMember,
  findVoteForViewer,
  isTeamMember,
  joinTeam,
  listPendingCompetitionRequests,
  listPublishedCompetitions,
  listSubmissionsForCompetition,
  listTeamMembers,
  listTeamMemberIds,
  listTeamsForCompetition,
  reviewCompetition,
  submitJuryScore,
  updateSubmission,
} from "../repositories/competitions.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { findProfileById } from "../repositories/chat.js";
import { findProjectById } from "../repositories/projects.js";
import {
  awardPoints,
  computeProfilePoints,
  POINTS_COMPETITION_PARTICIPATION,
  POINTS_COMPETITION_VICTORY_BY_RANK,
} from "../repositories/points.js";
import {
  serializeCompetitionDetail,
  serializeCompetitionSummary,
  serializeSubmission,
  serializeSubmissionResult,
  serializeTeam,
} from "../competition-serializers.js";
import type { ChatAppDeps } from "../app.js";

const JUROR_LEVELS = new Set(["architecte", "legende"]);

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de participer à une compétition.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireAdmin(db: ChatAppDeps["db"], userId: string) {
  const profile = await requireOwnProfile(db, userId);
  if (!profile.isPlatformAdmin) throw forbidden("Réservé aux administrateurs.");
  return profile;
}

async function requireCompetitionBySlug(db: ChatAppDeps["db"], slug: string) {
  const competition = await findCompetitionBySlug(db, slug);
  if (!competition) throw notFound("Cette compétition n'existe pas.");
  return competition;
}

export function registerCompetitionRoutes(app: FastifyInstance, { db, auth }: ChatAppDeps): void {
  // Lecture ouverte aux visiteurs (aucune compétition, équipe ou soumission
  // n'est privée) ; un visiteur est traité comme un lecteur sans équipe.
  async function findViewerProfile(request: FastifyRequest) {
    const userId = await getSessionUserId(auth, request);
    return userId ? findProfileByUserId(db, userId) : null;
  }

  // Une compétition non publiée n'existe que pour son auteur et les
  // administrateurs, sur chaque route de lecture et pas seulement le détail.
  async function requireVisibleCompetition(
    slug: string,
    profile: Awaited<ReturnType<typeof findViewerProfile>>,
  ) {
    const competition = await requireCompetitionBySlug(db, slug);
    const isCreator = profile?.id === competition.createdBy;
    const isAdmin = profile?.isPlatformAdmin ?? false;
    if (competition.status !== "published" && !isCreator && !isAdmin)
      throw notFound("Cette compétition n'existe pas.");
    return { competition, isCreator, isAdmin };
  }

  // Lectures publiques : sans session, la limite est la seule borne.
  const publicReadLimit = { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } };

  app.post(
    "/api/competitions",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = createCompetitionRequestSchema.parse(request.body);
      const existing = await findCompetitionBySlug(db, input.slug);
      if (existing) throw conflict("Une compétition avec cet identifiant existe déjà.");
      const competition = await createCompetitionRequest(db, profile.id, input);
      return {
        competition: serializeCompetitionDetail(competition, 0, 0, profile, {
          isCreator: true,
          isAdmin: profile.isPlatformAdmin,
          isJuror: false,
        }),
      };
    },
  );

  app.get<{ Querystring: { cursor?: string; limit?: string } }>(
    "/api/competitions",
    publicReadLimit,
    async (request) => {
      const query = paginationQuerySchema.parse(request.query);
      const page = await listPublishedCompetitions(db, query.cursor, query.limit);
      const items = await Promise.all(
        page.items.map(async (row) =>
          serializeCompetitionSummary(
            row,
            await countTeams(db, row.id),
            await countSubmissions(db, row.id),
          ),
        ),
      );
      return { items, nextCursor: page.nextCursor };
    },
  );

  app.get("/api/competitions/pending", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireAdmin(db, userId);
    const rows = await listPendingCompetitionRequests(db);
    const items = await Promise.all(
      rows.map(async (row) => {
        const creator = await findProfileById(db, row.createdBy);
        return serializeCompetitionDetail(row, 0, 0, creator!, {
          isCreator: false,
          isAdmin: true,
          isJuror: false,
        });
      }),
    );
    return { items };
  });

  app.put<{ Params: { id: string } }>(
    "/api/competitions/:id/review",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const admin = await requireAdmin(db, userId);
      const input = reviewCompetitionSchema.parse(request.body);
      const existing = await findCompetitionById(db, request.params.id);
      if (!existing) throw notFound("Cette compétition n'existe pas.");
      if (existing.status !== "pending_review")
        throw conflict("Cette compétition a déjà reçu une décision.");
      const reviewed = await reviewCompetition(db, request.params.id, admin.id, input);
      if (!reviewed) throw notFound("Cette compétition n'existe pas.");
      const creator = await findProfileById(db, reviewed.createdBy);
      return {
        competition: serializeCompetitionDetail(reviewed, 0, 0, creator!, {
          isCreator: false,
          isAdmin: true,
          isJuror: false,
        }),
      };
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/competitions/:slug",
    publicReadLimit,
    async (request) => {
      const profile = await findViewerProfile(request);
      const { competition, isCreator, isAdmin } = await requireVisibleCompetition(
        request.params.slug,
        profile,
      );
      const { level } = profile
        ? await computeProfilePoints(db, profile.id)
        : { level: "apprenti" as const };
      const creator = await findProfileById(db, competition.createdBy);
      return {
        competition: serializeCompetitionDetail(
          competition,
          await countTeams(db, competition.id),
          await countSubmissions(db, competition.id),
          creator!,
          { isCreator, isAdmin, isJuror: JUROR_LEVELS.has(level) },
        ),
      };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/api/competitions/:slug/teams",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const competition = await requireCompetitionBySlug(db, request.params.slug);
      if (competition.status !== "published") throw notFound("Cette compétition n'existe pas.");
      if (computeCompetitionPhase(competition) !== "registration")
        throw badRequest("Les inscriptions sont fermées pour cette compétition.");
      const input = createTeamSchema.parse(request.body);
      const result = await createTeam(db, competition.id, profile.id, input);
      if ("error" in result) {
        if (result.error === "already_member")
          throw conflict("Vous faites déjà partie d'une équipe de cette compétition.");
        throw conflict("Ce nom d'équipe est déjà pris pour cette compétition.");
      }
      return { team: serializeTeam(result.team, profile, [profile], false, true) };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/teams/:id/join",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const team = await findTeamById(db, request.params.id);
      if (!team) throw notFound("Cette équipe n'existe pas.");
      const competition = await findCompetitionById(db, team.competitionId);
      if (computeCompetitionPhase(competition!) !== "registration")
        throw badRequest("Les inscriptions sont fermées pour cette compétition.");
      const member = await joinTeam(db, team.id, team.competitionId, profile.id);
      if (!member) throw conflict("Vous faites déjà partie d'une équipe de cette compétition.");
      const [captain, members] = await Promise.all([
        findProfileById(db, team.captainId),
        listTeamMembers(db, team.id),
      ]);
      return { team: serializeTeam(team, captain!, members, false, true) };
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/competitions/:slug/teams",
    publicReadLimit,
    async (request) => {
      const profile = await findViewerProfile(request);
      const { competition } = await requireVisibleCompetition(request.params.slug, profile);
      const rows = await listTeamsForCompetition(db, competition.id);
      const items = await Promise.all(
        rows.map(async (team) => {
          const [captain, members, submission] = await Promise.all([
            findProfileById(db, team.captainId),
            listTeamMembers(db, team.id),
            findSubmissionByTeamId(db, team.id),
          ]);
          const viewerIsMember = profile ? await isTeamMember(db, team.id, profile.id) : false;
          return serializeTeam(team, captain!, members, submission !== null, viewerIsMember);
        }),
      );
      return { items };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/api/competitions/:slug/submissions",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const competition = await requireCompetitionBySlug(db, request.params.slug);
      if (competition.status !== "published") throw notFound("Cette compétition n'existe pas.");
      if (computeCompetitionPhase(competition) !== "submission")
        throw badRequest("Les soumissions ne sont pas ouvertes pour cette compétition.");
      const team = await findTeamForMember(db, competition.id, profile.id);
      if (!team) throw forbidden("Rejoignez une équipe avant de soumettre un projet.");
      const existing = await findSubmissionByTeamId(db, team.id);
      if (existing) throw conflict("Cette équipe a déjà soumis un projet.");
      const input = createSubmissionSchema.parse(request.body);
      const project = await findProjectById(db, input.projectId);
      if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
      if (project.ownerId !== profile.id)
        throw forbidden("Seul le propriétaire du projet peut le soumettre à une compétition.");
      const submission = await createSubmission(db, competition.id, team.id, profile.id, input);
      const memberIds = await listTeamMemberIds(db, team.id);
      await Promise.all(
        memberIds.map((memberId) =>
          awardPoints(db, {
            profileId: memberId,
            source: "competition_participation",
            sourceId: submission.id,
            amount: POINTS_COMPETITION_PARTICIPATION,
          }),
        ),
      );
      return {
        submission: serializeSubmission(
          submission,
          team.name,
          project.slug,
          profile.handle,
          true,
          true,
        ),
      };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/submissions/:id",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const submission = await findSubmissionById(db, request.params.id);
      if (!submission) throw notFound("Cette soumission n'existe pas.");
      const isMember = await isTeamMember(db, submission.teamId, profile.id);
      if (!isMember)
        throw forbidden("Seule l'équipe à l'origine de cette soumission peut la modifier.");
      const competition = await findCompetitionById(db, submission.competitionId);
      if (computeCompetitionPhase(competition!) !== "submission")
        throw badRequest("Les soumissions ne sont plus modifiables pour cette compétition.");
      const input = updateSubmissionSchema.parse(request.body);
      if (input.projectId) {
        const project = await findProjectById(db, input.projectId);
        if (!project || project.deletedAt) throw notFound("Ce projet n'existe pas.");
        if (project.ownerId !== profile.id)
          throw forbidden("Seul le propriétaire du projet peut le soumettre à une compétition.");
      }
      const updated = await updateSubmission(db, submission.id, input);
      const project = await findProjectById(db, updated.projectId);
      return {
        submission: serializeSubmission(updated, "", project!.slug, profile.handle, true, true),
      };
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/competitions/:slug/submissions",
    publicReadLimit,
    async (request) => {
      const profile = await findViewerProfile(request);
      const { competition } = await requireVisibleCompetition(request.params.slug, profile);
      const rows = await listSubmissionsForCompetition(db, competition.id);
      const stillInSubmissionPhase = computeCompetitionPhase(competition) === "submission";
      const items = await Promise.all(
        rows.map(async ({ submission, team }) => {
          const [project, author] = await Promise.all([
            findProjectById(db, submission.projectId),
            findProfileById(db, submission.authorId),
          ]);
          const viewerIsTeamMember = profile ? await isTeamMember(db, team.id, profile.id) : false;
          const detailsVisible = viewerIsTeamMember || !stillInSubmissionPhase;
          return serializeSubmission(
            submission,
            team.name,
            project!.slug,
            author!.handle,
            viewerIsTeamMember,
            detailsVisible,
          );
        }),
      );
      return { items };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/submissions/:id/vote",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const submission = await findSubmissionById(db, request.params.id);
      if (!submission) throw notFound("Cette soumission n'existe pas.");
      const competition = await findCompetitionById(db, submission.competitionId);
      if (computeCompetitionPhase(competition!) !== "voting")
        throw badRequest("Le vote n'est pas ouvert pour cette compétition.");
      const vote = await castVote(db, submission.competitionId, submission.id, profile.id);
      if (!vote)
        throw forbidden("Vous ne pouvez pas voter pour la soumission de votre propre équipe.");
      return { submissionId: vote.submissionId };
    },
  );

  app.get<{ Params: { slug: string } }>("/api/competitions/:slug/my-vote", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const competition = await requireCompetitionBySlug(db, request.params.slug);
    const vote = await findVoteForViewer(db, competition.id, profile.id);
    return { submissionId: vote?.submissionId ?? null };
  });

  app.put<{ Params: { id: string } }>(
    "/api/submissions/:id/jury-score",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { level } = await computeProfilePoints(db, profile.id);
      if (!JUROR_LEVELS.has(level))
        throw forbidden("Seuls les niveaux Architecte et Légende peuvent noter une soumission.");
      const submission = await findSubmissionById(db, request.params.id);
      if (!submission) throw notFound("Cette soumission n'existe pas.");
      const competition = await findCompetitionById(db, submission.competitionId);
      if (computeCompetitionPhase(competition!) !== "voting")
        throw badRequest("Le jury ne note plus pour cette compétition.");
      const input = juryScoreInputSchema.parse(request.body);
      const score = await submitJuryScore(
        db,
        submission.competitionId,
        submission.id,
        profile.id,
        input,
      );
      if (!score) throw forbidden("Vous ne pouvez pas noter la soumission de votre propre équipe.");
      return { score: score.score };
    },
  );

  app.get<{ Params: { slug: string } }>(
    "/api/competitions/:slug/results",
    // Chaque lecture rejoue l'attribution idempotente du podium : limite plus
    // serrée que les autres lectures publiques.
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const { competition } = await requireVisibleCompetition(
        request.params.slug,
        await findViewerProfile(request),
      );
      if (computeCompetitionPhase(competition) !== "closed")
        throw badRequest("Le vote n'est pas encore terminé pour cette compétition.");
      const standings = await computeStandings(db, competition.id);
      // Idempotent par construction (points_ledger_source_dedup_idx) : relire
      // les résultats plusieurs fois ne redonne jamais deux fois les points.
      await Promise.all(
        standings
          .slice(0, POINTS_COMPETITION_VICTORY_BY_RANK.length)
          .map(async (standing, index) => {
            const amount = POINTS_COMPETITION_VICTORY_BY_RANK[index]!;
            const memberIds = await listTeamMemberIds(db, standing.teamId);
            await Promise.all(
              memberIds.map((memberId) =>
                awardPoints(db, {
                  profileId: memberId,
                  source: "competition_victory",
                  sourceId: standing.submissionId,
                  amount,
                }),
              ),
            );
          }),
      );
      return {
        items: standings.map((standing, index) => serializeSubmissionResult(standing, index + 1)),
      };
    },
  );
}
