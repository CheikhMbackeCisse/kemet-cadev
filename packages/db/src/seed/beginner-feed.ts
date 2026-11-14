import { and, eq, inArray, isNull, like } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { feedPinnedPosts, postReplies, posts, profiles, skills } from "../schema/index.js";
import {
  BEGINNER_FEED_POSTS,
  GIT_MEMO_POST,
  LOOPS_POST,
  LOOPS_SKILL,
  type BeginnerPost,
} from "./beginner-feed-content.js";
import { demoUuid } from "./demo-uuid.js";
import { topUpHearts } from "./showcase.js";
import { hoursAgo } from "./time.js";

const MINUTE_MS = 60_000;
const CADEV_POST_ID = demoUuid("post:cadev-en-bref");
const WAVE_POST_ID = demoUuid("showcase-post:wave-webhook-question");
export const LOOPS_POST_ID = demoUuid("beginner-feed-post:for-ou-while");
export const LOOPS_SKILL_ID = demoUuid("beginner-feed-skill:choisir-la-bonne-boucle");

export type BeginnerFeedResult =
  | { status: "done"; posts: number; replies: number; skill: boolean }
  | { status: "skipped"; reason: string };

async function insertPost(db: DbOrTx, post: BeginnerPost, ids: Map<string, string>) {
  const postId = demoUuid(`beginner-feed-post:${post.key}`);
  const createdAt = hoursAgo(post.hoursAgo);
  const inserted = await db
    .insert(posts)
    .values({
      id: postId,
      authorId: ids.get(post.authorHandle)!,
      body: post.body,
      format: post.format ?? null,
      isBeginner: true,
      createdAt,
    })
    .onConflictDoNothing()
    .returning({ id: posts.id });
  const [row] = await db
    .select({ authorId: posts.authorId, createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.id, postId));
  // Identifiant porté par un post qui n'est pas de démonstration : on n'y touche pas.
  if (!row || ![...ids.values()].includes(row.authorId)) return { created: 0, replies: 0 };
  const latest = Date.now() - MINUTE_MS;
  const replies =
    post.replies.length === 0
      ? []
      : await db
          .insert(postReplies)
          .values(
            post.replies.map((reply) => ({
              id: demoUuid(`beginner-feed-reply:${post.key}:${reply.key}`),
              postId,
              authorId: ids.get(reply.authorHandle)!,
              body: reply.body,
              createdAt: new Date(
                Math.min(row.createdAt.getTime() + reply.minutesAfter * MINUTE_MS, latest),
              ),
            })),
          )
          .onConflictDoNothing()
          .returning({ id: postReplies.id });
  if (post.hearts > 0) await topUpHearts(db, postId, post.hearts);
  return { created: inserted.length, replies: replies.length };
}

/**
 * Le fil s'ouvre sur des posts qu'un débutant peut lire : le post sur les
 * boucles épinglé juste après celui de Systalink (à la place de la question
 * Wave, qui reste dans le fil), trois posts intercalés entre les posts plus
 * pointus, et le skill que Kocc cite sous le post sur les boucles.
 * Relançable : rien n'est ajouté deux fois, aucun cœur n'est retiré, aucun
 * compte réel n'est touché.
 */
export async function seedBeginnerFeed(db: DbOrTx): Promise<BeginnerFeedResult> {
  const handles = [
    ...new Set(
      [LOOPS_POST, ...BEGINNER_FEED_POSTS].flatMap((post) => [
        post.authorHandle,
        ...post.replies.map((reply) => reply.authorHandle),
      ]),
    ),
    GIT_MEMO_POST.authorHandle,
  ];
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(and(inArray(profiles.handle, handles), eq(profiles.isDemo, true)));
  const ids = new Map(rows.map((row) => [row.handle, row.id]));
  if (handles.some((handle) => !ids.has(handle)))
    return { status: "skipped", reason: "comptes de démonstration absents" };

  return db.transaction(async (tx) => {
    const skill = await tx
      .insert(skills)
      .values({
        id: LOOPS_SKILL_ID,
        authorId: ids.get(LOOPS_POST.authorHandle)!,
        slug: LOOPS_SKILL.slug,
        name: LOOPS_SKILL.name,
        description: LOOPS_SKILL.description,
        content: LOOPS_SKILL.content,
        tags: LOOPS_SKILL.tags,
        visibility: "public",
        isBeginner: true,
        isDemo: true,
        createdAt: hoursAgo(24 * 6),
      })
      .onConflictDoNothing()
      .returning({ id: skills.id });

    let created = 0;
    let replies = 0;
    for (const post of [LOOPS_POST, ...BEGINNER_FEED_POSTS]) {
      const result = await insertPost(tx, post, ids);
      created += result.created;
      replies += result.replies;
    }

    const [gitMemo] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, ids.get(GIT_MEMO_POST.authorHandle)!),
          like(posts.body, `${GIT_MEMO_POST.bodyStart}%`),
          isNull(posts.deletedAt),
        ),
      )
      .limit(1);
    if (gitMemo) await topUpHearts(tx, gitMemo.id, GIT_MEMO_POST.hearts);

    const [loops] = await tx
      .select({ authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, LOOPS_POST_ID));
    const [cadev] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.id, CADEV_POST_ID));
    if (loops && [...ids.values()].includes(loops.authorId) && cadev) {
      await tx.delete(feedPinnedPosts).where(eq(feedPinnedPosts.postId, WAVE_POST_ID));
      await tx
        .insert(feedPinnedPosts)
        .values({ postId: LOOPS_POST_ID, position: 1 })
        .onConflictDoNothing();
    }

    return { status: "done", posts: created, replies, skill: skill.length > 0 };
  });
}
