import { and, asc, eq, inArray, or } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  assistantInvocations,
  postReactions,
  postReplies,
  posts,
  profiles,
  skills,
} from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { WAVE_SHOWCASE } from "./showcase-content.js";
import { hoursAgo } from "./time.js";

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
 * Cœurs donnés par des figurants (ADR 0032) : comptés, jamais montrés. Toujours
 * les mêmes figurants, donc un second passage n'ajoute rien.
 */
export async function topUpHearts(db: DbOrTx, postId: string, target: number): Promise<void> {
  const fillers = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.isFiller, true))
    .orderBy(asc(profiles.id))
    .limit(target);
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

/**
 * Ce qu'un visiteur voit en premier : la question Wave et la réponse
 * enregistrée de @kemet. Relancé à chaque seed, ne complète que ce qui manque.
 */
export async function seedShowcase(db: DbOrTx): Promise<ShowcaseResult> {
  const handles = [
    ASSISTANT_HANDLE,
    WAVE_SHOWCASE.authorHandle,
    ...WAVE_SHOWCASE.replies.map((reply) => reply.authorHandle),
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

  await db.transaction((tx) => seedWaveQuestion(tx, ids, waveSkill.id));
  return { status: "done" };
}
