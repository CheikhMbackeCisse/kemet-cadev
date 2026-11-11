import { and, asc, count, eq, inArray, isNull, like, notInArray, or } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  assistantInvocations,
  competitions,
  postReactions,
  postReplies,
  posts,
  profiles,
  projects,
  skills,
  submissions,
  teamMembers,
  teams,
} from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import {
  FEED_TOP_POSTS,
  SHOWCASE_SUBMISSIONS,
  WAVE_SHOWCASE,
  type ShowcaseSubmission,
} from "./showcase-content.js";
import { daysAgo, daysFromNow, hoursAgo } from "./time.js";

const ASSISTANT_HANDLE = "kemet";
// Profil de l'assistant créé par la migration 0003, jamais connectable.
const ASSISTANT_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const MINUTE_MS = 60_000;

export type ShowcaseResult = { status: "done" } | { status: "skipped"; reason: string };

/**
 * Comptes de démonstration seulement : un compte réel qui aurait repris un
 * identifiant de démo n'écrit jamais rien par le seed.
 */
async function profileIdsByHandle(db: DbOrTx, handles: string[]): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(
      or(
        and(inArray(profiles.handle, handles), eq(profiles.isDemo, true)),
        eq(profiles.id, ASSISTANT_PROFILE_ID),
      ),
    );
  return new Map(
    rows.map((row) => [row.id === ASSISTANT_PROFILE_ID ? ASSISTANT_HANDLE : row.handle, row.id]),
  );
}

/**
 * Complète les cœurs d'un post jusqu'à `target` avec des figurants (ADR 0032) :
 * comptés, jamais montrés. N'en retire jamais.
 */
async function topUpHearts(db: DbOrTx, postId: string, target: number): Promise<void> {
  const reactions = await db
    .select({ profileId: postReactions.profileId })
    .from(postReactions)
    .where(eq(postReactions.postId, postId));
  const missing = target - reactions.length;
  if (missing <= 0) return;
  const reacted = reactions.map((reaction) => reaction.profileId);
  const fillers = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.isFiller, true),
        reacted.length > 0 ? notInArray(profiles.id, reacted) : undefined,
      ),
    )
    .orderBy(asc(profiles.id))
    .limit(missing);
  if (fillers.length === 0) return;
  await db
    .insert(postReactions)
    .values(fillers.map((filler) => ({ postId, profileId: filler.id })))
    .onConflictDoNothing();
}

async function seedWaveQuestion(db: DbOrTx, ids: Map<string, string>, waveSkillId: string) {
  const showcase = WAVE_SHOWCASE;
  const postId = demoUuid(`showcase-post:${showcase.key}`);
  const [existing] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
  if (!existing) {
    const askedBy = ids.get(showcase.authorHandle)!;
    const postedAt = hoursAgo(showcase.hoursAgo);
    const triggeredAt = new Date(postedAt.getTime() + 2 * MINUTE_MS);
    const answeredAt = new Date(triggeredAt.getTime() + 20_000);
    const triggerId = demoUuid(`showcase-reply:${showcase.key}:trigger`);
    const answerId = demoUuid(`showcase-reply:${showcase.key}:kemet`);

    await db.insert(posts).values({
      id: postId,
      authorId: askedBy,
      body: showcase.body,
      format: "question",
      createdAt: postedAt,
    });
    await db.insert(postReplies).values([
      { id: triggerId, postId, authorId: askedBy, body: showcase.trigger, createdAt: triggeredAt },
      {
        id: answerId,
        postId,
        authorId: ids.get(ASSISTANT_HANDLE)!,
        body: showcase.recording.answer,
        createdAt: answeredAt,
      },
      ...showcase.replies.map((reply) => ({
        id: demoUuid(`showcase-reply:${showcase.key}:${reply.key}`),
        postId,
        authorId: ids.get(reply.authorHandle)!,
        body: reply.body,
        createdAt: new Date(postedAt.getTime() + reply.minutesAfter * MINUTE_MS),
      })),
    ]);
    await db.insert(assistantInvocations).values({
      postId,
      triggerReplyId: triggerId,
      responseReplyId: answerId,
      requestedBy: askedBy,
      skillIds: [waveSkillId],
      status: "done",
      recorded: true,
      createdAt: triggeredAt,
      completedAt: answeredAt,
    });
  }
  await topUpHearts(db, postId, showcase.hearts);
}

async function seedTopPosts(db: DbOrTx, ids: Map<string, string>): Promise<void> {
  for (const entry of FEED_TOP_POSTS) {
    const [post] = await db
      .select({ id: posts.id, createdAt: posts.createdAt })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, ids.get(entry.authorHandle)!),
          like(posts.body, `${entry.bodyStart}%`),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    if (!post) continue;
    await db
      .insert(postReplies)
      .values(
        entry.replies.map((reply) => ({
          id: demoUuid(`showcase-reply:${entry.key}:${reply.key}`),
          postId: post.id,
          authorId: ids.get(reply.authorHandle)!,
          body: reply.body,
          createdAt: new Date(post.createdAt.getTime() + reply.minutesAfter * MINUTE_MS),
        })),
      )
      .onConflictDoNothing();
    await topUpHearts(db, post.id, entry.hearts);
  }
}

async function findOrCreateTeam(
  db: DbOrTx,
  competitionId: string,
  entry: ShowcaseSubmission,
  ids: Map<string, string>,
): Promise<string> {
  const [existing] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.competitionId, competitionId), eq(teams.name, entry.team)));
  if (existing) return existing.id;
  const [team] = await db
    .insert(teams)
    .values({ competitionId, captainId: ids.get(entry.captainHandle)!, name: entry.team })
    .returning({ id: teams.id });
  await db
    .insert(teamMembers)
    .values(
      [entry.captainHandle, ...entry.memberHandles].map((handle) => ({
        teamId: team!.id,
        competitionId,
        profileId: ids.get(handle)!,
      })),
    )
    .onConflictDoNothing();
  return team!.id;
}

/**
 * Compétitions d'exemple encore en inscription : passées une seule fois en
 * phase de soumission, puis complétées des soumissions qui manquent. Seulement
 * celles créées par un compte de démonstration.
 */
async function seedCompetitionSubmissions(db: DbOrTx, ids: Map<string, string>): Promise<void> {
  for (const plan of SHOWCASE_SUBMISSIONS) {
    const [competition] = await db
      .select({ id: competitions.id, registrationClosesAt: competitions.registrationClosesAt })
      .from(competitions)
      .innerJoin(profiles, eq(profiles.id, competitions.createdBy))
      .where(and(eq(competitions.slug, plan.competitionSlug), eq(profiles.isDemo, true)));
    if (!competition) continue;
    if (competition.registrationClosesAt > new Date())
      await db
        .update(competitions)
        .set({
          registrationClosesAt: daysAgo(1),
          submissionClosesAt: daysFromNow(plan.submissionClosesInDays),
          votingClosesAt: daysFromNow(plan.submissionClosesInDays + 7),
        })
        .where(eq(competitions.id, competition.id));

    for (const [index, entry] of plan.submissions.entries()) {
      const teamId = await findOrCreateTeam(db, competition.id, entry, ids);
      const [{ total }] = (await db
        .select({ total: count() })
        .from(submissions)
        .where(eq(submissions.teamId, teamId))) as [{ total: number }];
      if (total > 0) continue;
      const captainId = ids.get(entry.captainHandle)!;
      const repoUrl = `https://code.demo.kemetlabs.dev/${entry.captainHandle}/${entry.projectSlug}`;
      const projectId = demoUuid(`showcase-project:${entry.projectSlug}`);
      await db
        .insert(projects)
        .values({
          id: projectId,
          ownerId: captainId,
          slug: entry.projectSlug,
          name: entry.title,
          pitch: entry.pitch,
          description: entry.description,
          repoUrl,
          createdAt: daysAgo(2),
        })
        .onConflictDoNothing();
      await db.insert(submissions).values({
        id: demoUuid(`showcase-submission:${plan.competitionSlug}:${entry.projectSlug}`),
        teamId,
        competitionId: competition.id,
        projectId,
        authorId: captainId,
        title: entry.title,
        pitch: entry.pitch,
        description: entry.description,
        repoUrl,
        createdAt: hoursAgo(20 - index * 5),
      });
    }
  }
}

/**
 * Ce qu'un visiteur voit en premier : la question Wave et la réponse
 * enregistrée de @kemet, des réponses et des cœurs sur les posts qui suivent,
 * des soumissions dans les compétitions d'exemple. Relancé à chaque seed, ne
 * complète que ce qui manque.
 */
export async function seedShowcase(db: DbOrTx): Promise<ShowcaseResult> {
  const handles = [
    ...new Set([
      ASSISTANT_HANDLE,
      WAVE_SHOWCASE.authorHandle,
      ...WAVE_SHOWCASE.replies.map((reply) => reply.authorHandle),
      ...FEED_TOP_POSTS.flatMap((entry) => [
        entry.authorHandle,
        ...entry.replies.map((reply) => reply.authorHandle),
      ]),
      ...SHOWCASE_SUBMISSIONS.flatMap((plan) =>
        plan.submissions.flatMap((entry) => [entry.captainHandle, ...entry.memberHandles]),
      ),
    ]),
  ];
  const ids = await profileIdsByHandle(db, handles);
  const missing = handles.filter((handle) => !ids.has(handle));
  if (missing.length > 0)
    return { status: "skipped", reason: `comptes absents : ${missing.join(", ")}` };

  const [waveSkill] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.slug, WAVE_SHOWCASE.recording.skillSlug), eq(skills.isDemo, true)));
  if (!waveSkill) return { status: "skipped", reason: "skill wave-paiements absent" };

  await db.transaction(async (tx) => {
    await seedWaveQuestion(tx, ids, waveSkill.id);
    await seedTopPosts(tx, ids);
    await seedCompetitionSubmissions(tx, ids);
  });
  return { status: "done" };
}
