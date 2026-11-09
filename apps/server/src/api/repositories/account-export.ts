import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import {
  account,
  applications,
  assistantInvocations,
  competitions,
  conversationMembers,
  credentials,
  follows,
  helpRequests,
  juryScores,
  mcpServers,
  moderationActions,
  messageAttachments,
  messageReactions,
  messages,
  pointsLedger,
  postAttachments,
  postBookmarks,
  postFeedback,
  postReactions,
  postReplies,
  posts,
  profileBlocks,
  profiles,
  projects,
  readStates,
  reports,
  session,
  skillFiles,
  skillRatings,
  skills,
  spaceInvites,
  spaceMembers,
  spaces,
  submissions,
  teamMembers,
  teams,
  user,
  votes,
  workAttachments,
  workMedia,
  workAuthors,
  workExternalAuthors,
  workLinks,
  workMatchRequests,
  works,
  type Db,
} from "@kemet/db";

function omit<Columns extends object, Key extends keyof Columns>(
  columns: Columns,
  ...keys: Key[]
): Omit<Columns, Key> {
  const copy = { ...columns };
  for (const key of keys) delete copy[key];
  return copy;
}

// Détails internes (clé de stockage, index de recherche) et identité des
// administrateurs qui ont traité une demande : jamais dans l'export.
const messageAttachmentColumns = omit(getTableColumns(messageAttachments), "storageKey");
const postAttachmentColumns = omit(getTableColumns(postAttachments), "storageKey");
const skillColumns = omit(getTableColumns(skills), "searchVector");
const competitionColumns = omit(getTableColumns(competitions), "reviewedBy");
const reportColumns = omit(getTableColumns(reports), "resolvedBy");
const workColumns = omit(getTableColumns(works), "searchVector");
const workAttachmentColumns = omit(getTableColumns(workAttachments), "storageKey");
const workMediaColumns = omit(getTableColumns(workMedia), "storageKey");

/**
 * Toutes les données rattachées à un compte, lisibles par la personne
 * elle-même. Jamais de secret : ni mot de passe, ni jeton de session ou de
 * fournisseur de connexion.
 */
export async function buildAccountExport(db: Db, userId: string, profileId: string | null) {
  const [account_] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  const [sessions, linkedAccounts] = await Promise.all([
    db
      .select({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(eq(session.userId, userId)),
    db
      .select({ providerId: account.providerId, createdAt: account.createdAt })
      .from(account)
      .where(eq(account.userId, userId)),
  ]);

  const base = {
    exportedAt: new Date().toISOString(),
    account: account_ ?? null,
    sessions,
    linkedAccounts,
  };
  if (!profileId) return { ...base, profile: null };

  const [
    [profile],
    credentialRows,
    followingRows,
    followerRows,
    memberships,
    messageRows,
    messageReactionRows,
    messageAttachmentRows,
    postRows,
    postAttachmentRows,
    replyRows,
    postReactionRows,
    postBookmarkRows,
    feedbackRows,
    skillRows,
    skillRatingRows,
    invocationRows,
    mcpServerRows,
    projectRows,
    helpRequestRows,
    applicationRows,
    competitionRows,
    teamMembershipRows,
    submissionRows,
    voteRows,
    juryScoreRows,
    reportRows,
    pointsRows,
    readStateRows,
    inviteRows,
    captainedTeamRows,
    moderationActionRows,
    conversationRows,
    blockRows,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, profileId)),
    db.select().from(credentials).where(eq(credentials.profileId, profileId)),
    db
      .select({ handle: profiles.handle, since: follows.createdAt })
      .from(follows)
      .innerJoin(profiles, eq(profiles.id, follows.followeeId))
      .where(and(eq(follows.followerId, profileId), eq(profiles.isFiller, false))),
    db
      .select({ handle: profiles.handle, since: follows.createdAt })
      .from(follows)
      .innerJoin(profiles, eq(profiles.id, follows.followerId))
      .where(and(eq(follows.followeeId, profileId), eq(profiles.isFiller, false))),
    db
      .select({
        space: spaces.name,
        slug: spaces.slug,
        role: spaceMembers.role,
        joinedAt: spaceMembers.joinedAt,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(eq(spaceMembers.profileId, profileId)),
    db.select().from(messages).where(eq(messages.authorId, profileId)),
    db.select().from(messageReactions).where(eq(messageReactions.profileId, profileId)),
    db
      .select(messageAttachmentColumns)
      .from(messageAttachments)
      .where(eq(messageAttachments.authorId, profileId)),
    db.select().from(posts).where(eq(posts.authorId, profileId)),
    db
      .select(postAttachmentColumns)
      .from(postAttachments)
      .where(eq(postAttachments.authorId, profileId)),
    db.select().from(postReplies).where(eq(postReplies.authorId, profileId)),
    db.select().from(postReactions).where(eq(postReactions.profileId, profileId)),
    db.select().from(postBookmarks).where(eq(postBookmarks.profileId, profileId)),
    db.select().from(postFeedback).where(eq(postFeedback.authorId, profileId)),
    db.select(skillColumns).from(skills).where(eq(skills.authorId, profileId)),
    db.select().from(skillRatings).where(eq(skillRatings.raterId, profileId)),
    db.select().from(assistantInvocations).where(eq(assistantInvocations.requestedBy, profileId)),
    db.select().from(mcpServers).where(eq(mcpServers.addedBy, profileId)),
    db.select().from(projects).where(eq(projects.ownerId, profileId)),
    db.select().from(helpRequests).where(eq(helpRequests.authorId, profileId)),
    db.select().from(applications).where(eq(applications.applicantId, profileId)),
    db.select(competitionColumns).from(competitions).where(eq(competitions.createdBy, profileId)),
    db.select().from(teamMembers).where(eq(teamMembers.profileId, profileId)),
    db.select().from(submissions).where(eq(submissions.authorId, profileId)),
    db.select().from(votes).where(eq(votes.voterId, profileId)),
    db.select().from(juryScores).where(eq(juryScores.jurorId, profileId)),
    db.select(reportColumns).from(reports).where(eq(reports.reporterId, profileId)),
    db.select().from(pointsLedger).where(eq(pointsLedger.profileId, profileId)),
    db.select().from(readStates).where(eq(readStates.profileId, profileId)),
    db.select().from(spaceInvites).where(eq(spaceInvites.createdBy, profileId)),
    db.select().from(teams).where(eq(teams.captainId, profileId)),
    db.select().from(moderationActions).where(eq(moderationActions.actorId, profileId)),
    db.select().from(conversationMembers).where(eq(conversationMembers.profileId, profileId)),
    db
      .select({ handle: profiles.handle, since: profileBlocks.createdAt })
      .from(profileBlocks)
      .innerJoin(profiles, eq(profiles.id, profileBlocks.blockedId))
      .where(eq(profileBlocks.blockerId, profileId)),
  ]);
  const skillFileRows =
    skillRows.length === 0
      ? []
      : await db
          .select()
          .from(skillFiles)
          .where(
            inArray(
              skillFiles.skillId,
              skillRows.map((skill) => skill.id),
            ),
          );

  const workRows = await db.select(workColumns).from(works).where(eq(works.publisherId, profileId));
  const workIds = workRows.map((work) => work.id);
  const [
    workLinkRows,
    workExternalAuthorRows,
    workAttachmentRows,
    workMediaRows,
    coauthorshipRows,
    workMatchRows,
  ] = await Promise.all([
    workIds.length === 0
      ? []
      : db.select().from(workLinks).where(inArray(workLinks.workId, workIds)),
    workIds.length === 0
      ? []
      : db.select().from(workExternalAuthors).where(inArray(workExternalAuthors.workId, workIds)),
    db
      .select(workAttachmentColumns)
      .from(workAttachments)
      .where(eq(workAttachments.authorId, profileId)),
    db.select(workMediaColumns).from(workMedia).where(eq(workMedia.authorId, profileId)),
    db.select().from(workAuthors).where(eq(workAuthors.profileId, profileId)),
    db.select().from(workMatchRequests).where(eq(workMatchRequests.requestedBy, profileId)),
  ]);

  return {
    ...base,
    profile: profile ?? null,
    credentials: credentialRows,
    following: followingRows,
    followers: followerRows,
    spaces: memberships,
    messages: messageRows,
    messageReactions: messageReactionRows,
    messageAttachments: messageAttachmentRows,
    posts: postRows,
    postAttachments: postAttachmentRows,
    postReplies: replyRows,
    postReactions: postReactionRows,
    postBookmarks: postBookmarkRows,
    postFeedback: feedbackRows,
    skills: skillRows,
    skillFiles: skillFileRows,
    skillRatings: skillRatingRows,
    assistantInvocations: invocationRows,
    mcpServers: mcpServerRows,
    projects: projectRows,
    helpRequests: helpRequestRows,
    applications: applicationRows,
    competitions: competitionRows,
    teamMemberships: teamMembershipRows,
    submissions: submissionRows,
    votes: voteRows,
    juryScores: juryScoreRows,
    reports: reportRows,
    pointsLedger: pointsRows,
    readStates: readStateRows,
    spaceInvites: inviteRows,
    captainedTeams: captainedTeamRows,
    moderationActions: moderationActionRows,
    works: workRows,
    workLinks: workLinkRows,
    workExternalAuthors: workExternalAuthorRows,
    workAttachments: workAttachmentRows,
    workMedia: workMediaRows,
    workCoauthorships: coauthorshipRows,
    workMatchRequests: workMatchRows,
    conversations: conversationRows,
    blockedProfiles: blockRows,
  };
}
