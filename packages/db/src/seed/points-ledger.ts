import { and, avg, count, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbOrTx } from "../client.js";
import {
  competitionOfficialScore,
  POINTS_COMPETITION_PARTICIPATION,
  POINTS_COMPETITION_VICTORY_BY_RANK,
  POINTS_POST_FEEDBACK_GIVEN,
  POINTS_POST_REPLY_SOLUTION,
  POINTS_PROJECT_HELP_CONFIRMED,
} from "../points-rules.js";
import {
  applications,
  competitions,
  helpRequests,
  juryScores,
  pointsLedger,
  postFeedback,
  postReplies,
  posts,
  profiles,
  projects,
  submissions,
  teamMembers,
  votes,
} from "../schema/index.js";

type LedgerRow = typeof pointsLedger.$inferInsert;

// Les mêmes écritures que les routes du serveur, rejouées sur ce que le seed
// vient de créer : aucun total n'est posé à la main. Seuls les comptes de
// démonstration sont concernés, même si la base contient déjà de vrais comptes.
export async function recordDemoPoints(db: DbOrTx): Promise<void> {
  const rows: LedgerRow[] = [
    ...(await solutionRows(db)),
    ...(await feedbackRows(db)),
    ...(await projectHelpRows(db)),
    ...(await competitionRows(db)),
  ];
  if (rows.length === 0) return;
  await db
    .insert(pointsLedger)
    .values(rows)
    .onConflictDoNothing({ target: [pointsLedger.source, pointsLedger.sourceId, pointsLedger.profileId] });
}

async function solutionRows(db: DbOrTx): Promise<LedgerRow[]> {
  const replies = await db
    .select({ reply: postReplies, postAuthorId: posts.authorId })
    .from(postReplies)
    .innerJoin(posts, eq(posts.id, postReplies.postId))
    .innerJoin(profiles, eq(profiles.id, postReplies.authorId))
    .where(and(eq(postReplies.isSolution, true), eq(profiles.isDemo, true)));
  return replies
    .filter(({ reply, postAuthorId }) => reply.authorId !== postAuthorId)
    .map(({ reply, postAuthorId }) => ({
      profileId: reply.authorId,
      source: "post_reply_solution",
      sourceId: reply.id,
      amount: POINTS_POST_REPLY_SOLUTION,
      givenByProfileId: postAuthorId,
      createdAt: reply.createdAt,
    }));
}

async function feedbackRows(db: DbOrTx): Promise<LedgerRow[]> {
  const entries = await db
    .select({ feedback: postFeedback })
    .from(postFeedback)
    .innerJoin(profiles, eq(profiles.id, postFeedback.authorId))
    .where(eq(profiles.isDemo, true));
  return entries.map(({ feedback }) => ({
    profileId: feedback.authorId,
    source: "post_feedback_given",
    sourceId: feedback.id,
    amount: POINTS_POST_FEEDBACK_GIVEN,
    givenByProfileId: null,
    createdAt: feedback.createdAt,
  }));
}

async function projectHelpRows(db: DbOrTx): Promise<LedgerRow[]> {
  const accepted = await db
    .select({ application: applications, ownerId: projects.ownerId })
    .from(applications)
    .innerJoin(helpRequests, eq(helpRequests.id, applications.helpRequestId))
    .innerJoin(projects, eq(projects.id, helpRequests.projectId))
    .innerJoin(profiles, eq(profiles.id, applications.applicantId))
    .where(and(eq(applications.status, "accepted"), eq(profiles.isDemo, true)));
  return accepted.map(({ application, ownerId }) => ({
    profileId: application.applicantId,
    source: "project_help_confirmed",
    sourceId: application.id,
    amount: POINTS_PROJECT_HELP_CONFIRMED,
    givenByProfileId: ownerId,
    createdAt: application.decidedAt ?? application.createdAt,
  }));
}

async function competitionRows(db: DbOrTx): Promise<LedgerRow[]> {
  const creators = alias(profiles, "creators");
  const demoCompetitions = await db
    .select({ competition: competitions })
    .from(competitions)
    .innerJoin(creators, eq(creators.id, competitions.createdBy))
    .where(eq(creators.isDemo, true));
  const rows: LedgerRow[] = [];

  for (const { competition } of demoCompetitions) {
    const competitionSubmissions = await db.select().from(submissions).where(eq(submissions.competitionId, competition.id));
    if (competitionSubmissions.length === 0) continue;
    const members = await db
      .select()
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, competitionSubmissions.map((submission) => submission.teamId)));
    const membersOf = (teamId: string) => members.filter((member) => member.teamId === teamId).map((member) => member.profileId);

    for (const submission of competitionSubmissions) {
      for (const profileId of membersOf(submission.teamId)) {
        rows.push({
          profileId,
          source: "competition_participation",
          sourceId: submission.id,
          amount: POINTS_COMPETITION_PARTICIPATION,
          createdAt: submission.createdAt,
        });
      }
    }

    if (!(competition.votingClosesAt < new Date())) continue;
    const podium = await rankSubmissions(db, competition.id, competitionSubmissions);
    podium.slice(0, POINTS_COMPETITION_VICTORY_BY_RANK.length).forEach((submission, rank) => {
      for (const profileId of membersOf(submission.teamId)) {
        rows.push({
          profileId,
          source: "competition_victory",
          sourceId: submission.id,
          amount: POINTS_COMPETITION_VICTORY_BY_RANK[rank]!,
          createdAt: competition.votingClosesAt,
        });
      }
    });
  }
  return rows;
}

// Même classement que `computeStandings` côté serveur : score officiel, puis
// moyenne du jury pour départager.
async function rankSubmissions(
  db: DbOrTx,
  competitionId: string,
  competitionSubmissions: (typeof submissions.$inferSelect)[],
) {
  const jury = await db
    .select({ submissionId: juryScores.submissionId, average: avg(juryScores.score) })
    .from(juryScores)
    .where(eq(juryScores.competitionId, competitionId))
    .groupBy(juryScores.submissionId);
  const voteCounts = await db
    .select({ submissionId: votes.submissionId, count: count() })
    .from(votes)
    .where(eq(votes.competitionId, competitionId))
    .groupBy(votes.submissionId);
  const totalVotes = voteCounts.reduce((sum, row) => sum + row.count, 0);

  const scored = competitionSubmissions.map((submission) => {
    const juryEntry = jury.find((row) => row.submissionId === submission.id);
    const juryAverage = juryEntry?.average != null ? Number(juryEntry.average) : null;
    const voteCount = voteCounts.find((row) => row.submissionId === submission.id)?.count ?? 0;
    return { submission, juryAverage, officialScore: competitionOfficialScore(juryAverage, voteCount, totalVotes) };
  });
  scored.sort((a, b) =>
    b.officialScore !== a.officialScore ? b.officialScore - a.officialScore : (b.juryAverage ?? -1) - (a.juryAverage ?? -1),
  );
  return scored.map((entry) => entry.submission);
}
