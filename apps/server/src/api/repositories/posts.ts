import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { follows, postFeedback, postReactions, postReplies, posts, profiles, type Db, type DbOrTx } from "@kemet/db";
import type { CreatePostInput } from "@kemet/shared";
import { findProfileById } from "./chat.js";

// Fenêtre du classement "Pour toi" : sans les niveaux (lot 8, pas encore
// posé), pondérer par le niveau de ceux qui réagissent comme le prévoit
// docs/CONTEXTE.md est impossible. En attendant, un classement simple par
// "Utile" et retours de test sur les posts récents, revu une fois le lot 8
// posé (voir docs/adr/0010-fil-de-posts.md).
const POUR_TOI_WINDOW_DAYS = 14;

function toPage<T extends { createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function insertPost(
  db: DbOrTx,
  input: {
    authorId: string;
    body: string;
    format: CreatePostInput["format"] | null;
    testUrl: string | null;
    testAsk: string | null;
    sharedPostId: string | null;
  },
) {
  const [post] = await db
    .insert(posts)
    .values({
      authorId: input.authorId,
      body: input.body,
      format: input.format ?? null,
      testUrl: input.testUrl ?? null,
      testAsk: input.testAsk ?? null,
      sharedPostId: input.sharedPostId,
    })
    .returning();
  return post!;
}

export async function findPostById(db: Db, postId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  return post ?? null;
}

export async function editPost(db: Db, postId: string, body: string) {
  const [post] = await db.update(posts).set({ body, editedAt: new Date() }).where(eq(posts.id, postId)).returning();
  return post!;
}

export async function softDeletePost(db: Db, postId: string) {
  const [post] = await db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, postId)).returning();
  return post!;
}

export async function listFolloweeIds(db: Db, profileId: string) {
  const rows = await db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, profileId));
  return rows.map((row) => row.id);
}

export async function listAbonnementsFeed(db: Db, viewerProfileId: string, cursor: string | undefined, limit: number) {
  const followeeIds = await listFolloweeIds(db, viewerProfileId);
  const authorIds = [viewerProfileId, ...followeeIds];
  const visible = and(isNull(posts.deletedAt), inArray(posts.authorId, authorIds));
  const condition = cursor ? and(visible, lt(posts.createdAt, new Date(cursor))) : visible;
  const rows = await db.select().from(posts).where(condition).orderBy(desc(posts.createdAt)).limit(limit + 1);
  return toPage(rows, limit);
}

/**
 * Pas de pagination par curseur ici : le classement par score n'est pas
 * monotone avec la date, un curseur stable demanderait de figer le score au
 * premier chargement. Une liste bornée, sans page suivante, comme le quota
 * quotidien provisoire du lot 6 : une simplification à revoir plus tard.
 */
export async function listPourToiFeed(db: Db, limit: number) {
  const since = new Date(Date.now() - POUR_TOI_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const score = sql<number>`(
    (select count(*) from ${postReactions} where ${postReactions.postId} = ${posts.id}) * 2 +
    (select count(*) from ${postFeedback} where ${postFeedback.postId} = ${posts.id}) * 3
  )`;
  const rows = await db
    .select({ post: posts, score })
    .from(posts)
    .where(and(isNull(posts.deletedAt), gt(posts.createdAt, since)))
    .orderBy(desc(score), desc(posts.createdAt))
    .limit(limit);
  return { items: rows.map((row) => row.post), nextCursor: null as string | null };
}

export async function countPostReactions(db: DbOrTx, postId: string) {
  const rows = await db.select({ id: postReactions.id }).from(postReactions).where(eq(postReactions.postId, postId));
  return rows.length;
}

// Exclut les réponses supprimées, à la différence de countReplies côté
// messages (apps/server/src/api/repositories/chat.ts) : un compteur affiché
// sur une carte de post, jamais recalculé à l'ouverture d'un fil complet
// comme pour un message, ne doit pas annoncer des réponses qui n'existent
// plus pour qui les ouvre.
export async function countPostReplies(db: DbOrTx, postId: string) {
  const rows = await db
    .select({ id: postReplies.id })
    .from(postReplies)
    .where(and(eq(postReplies.postId, postId), isNull(postReplies.deletedAt)));
  return rows.length;
}

export async function countPostFeedback(db: DbOrTx, postId: string) {
  const rows = await db.select({ id: postFeedback.id }).from(postFeedback).where(eq(postFeedback.postId, postId));
  return rows.length;
}

export async function isPostReactedByProfile(db: DbOrTx, postId: string, profileId: string) {
  const [row] = await db
    .select({ id: postReactions.id })
    .from(postReactions)
    .where(and(eq(postReactions.postId, postId), eq(postReactions.profileId, profileId)));
  return row != null;
}

export async function togglePostReaction(db: Db, postId: string, profileId: string) {
  const existing = await isPostReactedByProfile(db, postId, profileId);
  if (existing) {
    await db.delete(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.profileId, profileId)));
  } else {
    await db.insert(postReactions).values({ postId, profileId }).onConflictDoNothing();
  }
  const utileCount = await countPostReactions(db, postId);
  return { utileCount, reactedByMe: !existing };
}

export async function hydratePost(db: Db, row: typeof posts.$inferSelect, viewerProfileId: string) {
  const [author, utileCount, reactedByMe, replyCount, feedbackCount, sharedPost] = await Promise.all([
    findProfileById(db, row.authorId),
    countPostReactions(db, row.id),
    isPostReactedByProfile(db, row.id, viewerProfileId),
    countPostReplies(db, row.id),
    countPostFeedback(db, row.id),
    row.sharedPostId ? findPostById(db, row.sharedPostId) : Promise.resolve(null),
  ]);
  const sharedAuthor = sharedPost ? await findProfileById(db, sharedPost.authorId) : null;
  return { row, author: author!, utileCount, reactedByMe, replyCount, feedbackCount, sharedPost, sharedAuthor };
}

export async function insertPostReply(db: Db, input: { postId: string; authorId: string; body: string }) {
  const [reply] = await db.insert(postReplies).values(input).returning();
  return reply!;
}

export async function findPostReplyById(db: Db, replyId: string) {
  const [reply] = await db.select().from(postReplies).where(eq(postReplies.id, replyId));
  return reply ?? null;
}

export async function softDeletePostReply(db: Db, replyId: string) {
  const [reply] = await db.update(postReplies).set({ deletedAt: new Date() }).where(eq(postReplies.id, replyId)).returning();
  return reply!;
}

export async function listPostReplies(db: Db, postId: string, cursor: string | undefined, limit: number) {
  const visible = eq(postReplies.postId, postId);
  const condition = cursor ? and(visible, gt(postReplies.createdAt, new Date(cursor))) : visible;
  const rows = await db.select().from(postReplies).where(condition).orderBy(asc(postReplies.createdAt)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function hydratePostReply(db: Db, row: typeof postReplies.$inferSelect) {
  const author = await findProfileById(db, row.authorId);
  return { row, author: author! };
}

/**
 * Une seule réponse "marquée comme solution" par post : on retire
 * d'abord toute marque existante dans la même transaction, pour ne jamais
 * laisser deux réponses marquées en même temps sous une écriture concurrente.
 */
export async function setPostReplySolution(db: Db, postId: string, replyId: string, isSolution: boolean) {
  return db.transaction(async (tx) => {
    if (isSolution) {
      await tx.update(postReplies).set({ isSolution: false }).where(eq(postReplies.postId, postId));
    }
    const [reply] = await tx.update(postReplies).set({ isSolution }).where(eq(postReplies.id, replyId)).returning();
    return reply!;
  });
}

/**
 * `null` si la contrainte unique (post_feedback_post_author_idx) a rejeté
 * l'insertion : deux requêtes concurrentes de la même personne peuvent
 * toutes deux franchir la vérification préalable côté route
 * (hasProfileGivenFeedback), seule celle-ci tranche de façon fiable.
 */
export async function insertPostFeedback(db: Db, input: { postId: string; authorId: string; body: string }) {
  const [feedback] = await db
    .insert(postFeedback)
    .values(input)
    .onConflictDoNothing({ target: [postFeedback.postId, postFeedback.authorId] })
    .returning();
  return feedback ?? null;
}

export async function hasProfileGivenFeedback(db: Db, postId: string, authorId: string) {
  const [row] = await db
    .select({ id: postFeedback.id })
    .from(postFeedback)
    .where(and(eq(postFeedback.postId, postId), eq(postFeedback.authorId, authorId)));
  return row != null;
}

export async function listPostFeedback(db: Db, postId: string) {
  return db
    .select({ feedback: postFeedback, author: profiles })
    .from(postFeedback)
    .innerJoin(profiles, eq(profiles.id, postFeedback.authorId))
    .where(eq(postFeedback.postId, postId))
    .orderBy(desc(postFeedback.createdAt));
}
