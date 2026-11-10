import type { competitions, submissions, teams } from "@kemet/db";
import type {
  CompetitionDetail,
  CompetitionPerson,
  CompetitionSummary,
  Submission,
  SubmissionResult,
  Team,
} from "@kemet/shared";
import { computeCompetitionPhase, type SubmissionStanding } from "./repositories/competitions.js";

type CompetitionRow = typeof competitions.$inferSelect;
type TeamRow = typeof teams.$inferSelect;
type SubmissionRow = typeof submissions.$inferSelect;

export function serializeCompetitionSummary(
  row: CompetitionRow,
  teamCount: number,
  submissionCount: number,
): CompetitionSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    pitch: row.pitch,
    status: row.status,
    phase: computeCompetitionPhase(row),
    registrationClosesAt: row.registrationClosesAt.toISOString(),
    submissionClosesAt: row.submissionClosesAt.toISOString(),
    votingClosesAt: row.votingClosesAt.toISOString(),
    teamCount,
    submissionCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeCompetitionDetail(
  row: CompetitionRow,
  teamCount: number,
  submissionCount: number,
  creator: CompetitionPerson,
  viewer: { isCreator: boolean; isAdmin: boolean; isJuror: boolean },
): CompetitionDetail {
  return {
    ...serializeCompetitionSummary(row, teamCount, submissionCount),
    description: row.description,
    createdByHandle: creator.handle,
    createdBy: toCompetitionPerson(creator),
    reviewNote: viewer.isCreator || viewer.isAdmin ? row.reviewNote : null,
    viewerIsCreator: viewer.isCreator,
    viewerIsJuror: viewer.isJuror,
  };
}

export function toCompetitionPerson(person: CompetitionPerson): CompetitionPerson {
  return {
    handle: person.handle,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl,
    country: person.country,
  };
}

export function serializeTeam(
  row: TeamRow,
  captain: CompetitionPerson,
  members: CompetitionPerson[],
  hasSubmission: boolean,
  viewerIsMember: boolean,
): Team {
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    captainHandle: captain.handle,
    memberHandles: members.map((member) => member.handle),
    captain: toCompetitionPerson(captain),
    members: members.map(toCompetitionPerson),
    hasSubmission,
    viewerIsMember,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * `detailsVisible` cache le dépôt, la démo et la description tant que la
 * compétition est encore en phase de soumission et que le lecteur n'est
 * pas membre de l'équipe : sans ce masquage, une équipe qui soumet tôt
 * laisserait son travail visible à toutes les équipes rivales avant leur
 * propre date limite.
 */
export function serializeSubmission(
  row: SubmissionRow,
  teamName: string,
  projectSlug: string,
  authorHandle: string,
  viewerIsTeamMember: boolean,
  detailsVisible: boolean,
): Submission {
  return {
    id: row.id,
    competitionId: row.competitionId,
    teamId: row.teamId,
    teamName,
    projectSlug,
    authorHandle,
    title: row.title,
    pitch: row.pitch,
    description: detailsVisible ? row.description : null,
    repoUrl: detailsVisible ? row.repoUrl : null,
    demoUrl: detailsVisible ? row.demoUrl : null,
    viewerIsTeamMember,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSubmissionResult(
  standing: SubmissionStanding,
  rank: number,
): SubmissionResult {
  return {
    submissionId: standing.submissionId,
    teamName: standing.teamName,
    rank,
    juryAverage: standing.juryAverage,
    juryScoreCount: standing.juryScoreCount,
    voteCount: standing.voteCount,
    officialScore: standing.officialScore,
  };
}
