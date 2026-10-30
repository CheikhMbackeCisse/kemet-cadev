import { and, avg, count, desc, eq, lt } from "drizzle-orm";
import {
  competitions,
  juryScores,
  profiles,
  projects,
  submissions,
  teamMembers,
  teams,
  votes,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import type {
  CompetitionPhase,
  CreateCompetitionRequestInput,
  CreateSubmissionInput,
  CreateTeamInput,
  JuryScoreInput,
  ReviewCompetitionInput,
  UpdateSubmissionInput,
} from "@kemet/shared";

function toPage<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

type CompetitionWindow = { registrationClosesAt: Date; submissionClosesAt: Date; votingClosesAt: Date };

/**
 * La phase ne se stocke jamais : elle se relit à chaque appel à partir des
 * trois échéances, comme le reste des états dérivés de ce projet (soldes,
 * niveaux). `now` n'est paramétrable que pour les tests.
 */
export function computeCompetitionPhase(competition: CompetitionWindow, now: Date = new Date()): CompetitionPhase {
  if (now < competition.registrationClosesAt) return "registration";
  if (now < competition.submissionClosesAt) return "submission";
  if (now < competition.votingClosesAt) return "voting";
  return "closed";
}

export async function createCompetitionRequest(db: Db, createdBy: string, input: CreateCompetitionRequestInput) {
  const [competition] = await db
    .insert(competitions)
    .values({
      createdBy,
      slug: input.slug,
      name: input.name,
      pitch: input.pitch,
      description: input.description,
      registrationClosesAt: new Date(input.registrationClosesAt),
      submissionClosesAt: new Date(input.submissionClosesAt),
      votingClosesAt: new Date(input.votingClosesAt),
    })
    .returning();
  return competition!;
}

export async function findCompetitionBySlug(db: DbOrTx, slug: string) {
  const [competition] = await db.select().from(competitions).where(eq(competitions.slug, slug));
  return competition ?? null;
}

export async function findCompetitionById(db: DbOrTx, competitionId: string) {
  const [competition] = await db.select().from(competitions).where(eq(competitions.id, competitionId));
  return competition ?? null;
}

export async function listPublishedCompetitions(db: Db, cursor: string | undefined, limit: number) {
  const visible = eq(competitions.status, "published");
  const condition = cursor ? and(visible, lt(competitions.createdAt, new Date(cursor))) : visible;
  const rows = await db.select().from(competitions).where(condition).orderBy(desc(competitions.createdAt)).limit(limit + 1);
  return toPage(rows, limit);
}

export async function listPendingCompetitionRequests(db: Db) {
  return db.select().from(competitions).where(eq(competitions.status, "pending_review")).orderBy(desc(competitions.createdAt));
}

/**
 * `null` si la compétition n'existe pas ou n'est plus en attente : une
 * décision déjà prise ne se rejoue pas, pour ne pas faire basculer une
 * compétition publiée (équipes, soumissions, votes en cours) vers refusée
 * par une seconde validation accidentelle.
 */
export async function reviewCompetition(db: Db, competitionId: string, reviewerId: string, input: ReviewCompetitionInput) {
  const [competition] = await db
    .update(competitions)
    .set({
      status: input.approve ? "published" : "rejected",
      reviewedBy: reviewerId,
      reviewNote: input.note ?? null,
    })
    .where(and(eq(competitions.id, competitionId), eq(competitions.status, "pending_review")))
    .returning();
  return competition ?? null;
}

export async function countTeams(db: DbOrTx, competitionId: string) {
  const [row] = await db.select({ value: count() }).from(teams).where(eq(teams.competitionId, competitionId));
  return row?.value ?? 0;
}

export async function countSubmissions(db: DbOrTx, competitionId: string) {
  const [row] = await db.select({ value: count() }).from(submissions).where(eq(submissions.competitionId, competitionId));
  return row?.value ?? 0;
}

export type CreateTeamResult =
  | { error: "already_member" }
  | { error: "name_taken" }
  | { team: typeof teams.$inferSelect };

/**
 * Les deux vérifications (déjà dans une équipe, nom déjà pris) se font
 * dans la même transaction que la création pour ne jamais laisser une
 * équipe orpheline sans capitaine inscrit comme membre.
 */
export async function createTeam(db: Db, competitionId: string, captainId: string, input: CreateTeamInput): Promise<CreateTeamResult> {
  return db.transaction(async (tx) => {
    const [alreadyMember, nameTaken] = await Promise.all([
      tx.select({ id: teamMembers.id }).from(teamMembers).where(and(eq(teamMembers.competitionId, competitionId), eq(teamMembers.profileId, captainId))),
      tx.select({ id: teams.id }).from(teams).where(and(eq(teams.competitionId, competitionId), eq(teams.name, input.name))),
    ]);
    if (alreadyMember.length > 0) return { error: "already_member" };
    if (nameTaken.length > 0) return { error: "name_taken" };
    const [team] = await tx.insert(teams).values({ competitionId, captainId, name: input.name }).returning();
    await tx.insert(teamMembers).values({ teamId: team!.id, competitionId, profileId: captainId });
    return { team: team! };
  });
}

/** `null` si la personne appartient déjà à une équipe de cette compétition. */
export async function joinTeam(db: Db, teamId: string, competitionId: string, profileId: string) {
  const [member] = await db
    .insert(teamMembers)
    .values({ teamId, competitionId, profileId })
    .onConflictDoNothing({ target: [teamMembers.competitionId, teamMembers.profileId] })
    .returning();
  return member ?? null;
}

export async function findTeamById(db: DbOrTx, teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  return team ?? null;
}

export async function findTeamForMember(db: DbOrTx, competitionId: string, profileId: string) {
  const [row] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.competitionId, competitionId), eq(teamMembers.profileId, profileId)));
  return row?.team ?? null;
}

export async function listTeamsForCompetition(db: DbOrTx, competitionId: string) {
  return db.select().from(teams).where(eq(teams.competitionId, competitionId)).orderBy(desc(teams.createdAt));
}

export async function listTeamMemberIds(db: DbOrTx, teamId: string) {
  const rows = await db.select({ profileId: teamMembers.profileId }).from(teamMembers).where(eq(teamMembers.teamId, teamId));
  return rows.map((row) => row.profileId);
}

export async function listTeamMemberHandles(db: DbOrTx, teamId: string) {
  const rows = await db
    .select({ handle: profiles.handle })
    .from(teamMembers)
    .innerJoin(profiles, eq(profiles.id, teamMembers.profileId))
    .where(eq(teamMembers.teamId, teamId));
  return rows.map((row) => row.handle);
}

export async function isTeamMember(db: DbOrTx, teamId: string, profileId: string) {
  const [row] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.profileId, profileId)));
  return row !== undefined;
}

export async function findProjectOwnerId(db: DbOrTx, projectId: string) {
  const [project] = await db.select({ ownerId: projects.ownerId }).from(projects).where(eq(projects.id, projectId));
  return project?.ownerId ?? null;
}

export async function findSubmissionByTeamId(db: DbOrTx, teamId: string) {
  const [submission] = await db.select().from(submissions).where(eq(submissions.teamId, teamId));
  return submission ?? null;
}

export async function findSubmissionById(db: DbOrTx, submissionId: string) {
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  return submission ?? null;
}

export async function createSubmission(
  db: Db,
  competitionId: string,
  teamId: string,
  authorId: string,
  input: CreateSubmissionInput,
) {
  const [submission] = await db
    .insert(submissions)
    .values({
      competitionId,
      teamId,
      projectId: input.projectId,
      authorId,
      title: input.title,
      pitch: input.pitch,
      description: input.description,
      repoUrl: input.repoUrl,
      demoUrl: input.demoUrl ?? null,
    })
    .returning();
  return submission!;
}

export async function updateSubmission(db: Db, submissionId: string, input: UpdateSubmissionInput) {
  const [submission] = await db
    .update(submissions)
    .set({
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.pitch !== undefined ? { pitch: input.pitch } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.repoUrl !== undefined ? { repoUrl: input.repoUrl } : {}),
      ...(input.demoUrl !== undefined ? { demoUrl: input.demoUrl } : {}),
    })
    .where(eq(submissions.id, submissionId))
    .returning();
  return submission!;
}

export async function listSubmissionsForCompetition(db: DbOrTx, competitionId: string) {
  return db
    .select({ submission: submissions, team: teams })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .where(eq(submissions.competitionId, competitionId))
    .orderBy(desc(submissions.createdAt));
}

/**
 * `null` si la soumission appartient à l'équipe du votant (auto-vote
 * refusé). Un même votant ne choisit qu'une soumission par compétition :
 * revoter met simplement à jour son choix, jusqu'à la fin du vote.
 */
export async function castVote(db: Db, competitionId: string, submissionId: string, voterId: string) {
  const [submission] = await db.select({ teamId: submissions.teamId }).from(submissions).where(eq(submissions.id, submissionId));
  if (!submission) return null;
  const ownTeam = await isTeamMember(db, submission.teamId, voterId);
  if (ownTeam) return null;
  const [vote] = await db
    .insert(votes)
    .values({ competitionId, submissionId, voterId })
    .onConflictDoUpdate({
      target: [votes.competitionId, votes.voterId],
      set: { submissionId },
    })
    .returning();
  return vote;
}

export async function findVoteForViewer(db: DbOrTx, competitionId: string, voterId: string) {
  const [vote] = await db.select().from(votes).where(and(eq(votes.competitionId, competitionId), eq(votes.voterId, voterId)));
  return vote ?? null;
}

/**
 * `null` si le juré appartient à l'équipe de la soumission qu'il note
 * (auto-notation refusée). Révisable jusqu'à la fin du vote : une seule
 * ligne par binôme (soumission, juré), mise à jour plutôt que dupliquée.
 */
export async function submitJuryScore(db: Db, competitionId: string, submissionId: string, jurorId: string, input: JuryScoreInput) {
  const [submission] = await db.select({ teamId: submissions.teamId }).from(submissions).where(eq(submissions.id, submissionId));
  if (!submission) return null;
  const ownTeam = await isTeamMember(db, submission.teamId, jurorId);
  if (ownTeam) return null;
  const [score] = await db
    .insert(juryScores)
    .values({ competitionId, submissionId, jurorId, score: input.score, comment: input.comment ?? null })
    .onConflictDoUpdate({
      target: [juryScores.submissionId, juryScores.jurorId],
      set: { score: input.score, comment: input.comment ?? null },
    })
    .returning();
  return score;
}

export interface SubmissionStanding {
  submissionId: string;
  teamId: string;
  teamName: string;
  juryAverage: number | null;
  juryScoreCount: number;
  voteCount: number;
  officialScore: number;
}

// Pondération arbitraire, expliquée dans docs/adr/0013-competitions.md.
const JURY_WEIGHT = 0.7;
const VOTE_WEIGHT = 0.3;

/**
 * Classement combiné, recalculé à chaque appel plutôt que stocké. Le score
 * officiel ramène le jury (sur 20) et le vote (part des voix de la
 * compétition) sur une même échelle 0-100 avant de les pondérer, pour que
 * les deux comptent peu importe le nombre de votants ou de jurés.
 */
export async function computeStandings(db: DbOrTx, competitionId: string): Promise<SubmissionStanding[]> {
  const rows = await db
    .select({ submission: submissions, team: teams })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .where(eq(submissions.competitionId, competitionId));

  const juryRows = await db
    .select({ submissionId: juryScores.submissionId, average: avg(juryScores.score), count: count() })
    .from(juryScores)
    .where(eq(juryScores.competitionId, competitionId))
    .groupBy(juryScores.submissionId);
  const juryBySubmission = new Map(juryRows.map((row) => [row.submissionId, row]));

  const voteRows = await db
    .select({ submissionId: votes.submissionId, count: count() })
    .from(votes)
    .where(eq(votes.competitionId, competitionId))
    .groupBy(votes.submissionId);
  const votesBySubmission = new Map(voteRows.map((row) => [row.submissionId, row.count]));
  const totalVotes = voteRows.reduce((sum, row) => sum + row.count, 0);

  const standings = rows.map(({ submission, team }) => {
    const jury = juryBySubmission.get(submission.id);
    const juryAverage = jury ? Number(jury.average) : null;
    const voteCount = votesBySubmission.get(submission.id) ?? 0;
    const juryShare = juryAverage !== null ? juryAverage / 20 : 0;
    const voteShare = totalVotes > 0 ? voteCount / totalVotes : 0;
    const officialScore = (JURY_WEIGHT * juryShare + VOTE_WEIGHT * voteShare) * 100;
    return {
      submissionId: submission.id,
      teamId: team.id,
      teamName: team.name,
      juryAverage,
      juryScoreCount: jury?.count ?? 0,
      voteCount,
      officialScore,
    };
  });

  return standings.sort((a, b) => {
    if (b.officialScore !== a.officialScore) return b.officialScore - a.officialScore;
    return (b.juryAverage ?? -1) - (a.juryAverage ?? -1);
  });
}
