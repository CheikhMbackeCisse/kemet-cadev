import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { follows, postFeedback, postReactions, postReplies, posts, profiles, works, type Db, type DbOrTx } from "@kemet/db";
import type { CreatePostInput } from "@kemet/shared";
import { findProfileById } from "./chat.js";
import { listAttachmentsForPosts } from "./post-attachments.js";

// Fenêtre du classement "Pour toi" : "Utile" et retours de test sur les
// posts récents, sans pondération par niveau (docs/adr/0010-fil-de-posts.md).
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
    workId?: string | null;
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
      workId: input.workId ?? null,
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
 * Liste bornée, sans curseur : le score n'est pas monotone avec la date, un
 * curseur stable demanderait de figer le score au premier chargement.
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
// messages : le compteur d'une carte ne doit pas annoncer des réponses
// absentes de la page du post.
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

// `viewerProfileId` est `null` pour un visiteur : jamais réagi, sans requête.
export async function hydratePost(db: Db, row: typeof posts.$inferSelect, viewerProfileId: string | null) {
  const [author, utileCount, reactedByMe, replyCount, feedbackCount, sharedPost, attachments, work] = await Promise.all([
    findProfileById(db, row.authorId),
    countPostReactions(db, row.id),
    viewerProfileId ? isPostReactedByProfile(db, row.id, viewerProfileId) : Promise.resolve(false),
    countPostReplies(db, row.id),
    countPostFeedback(db, row.id),
    row.sharedPostId ? findPostById(db, row.sharedPostId) : Promise.resolve(null),
    listAttachmentsForPosts(db, [row.id]),
    row.workId ? findLinkedWork(db, row.workId) : Promise.resolve(null),
  ]);
  const sharedAuthor = sharedPost ? await findProfileById(db, sharedPost.authorId) : null;
  const sharedAttachments = sharedPost ? await listAttachmentsForPosts(db, [sharedPost.id]) : [];
  return {
    row,
    author: author!,
    utileCount,
    reactedByMe,
    replyCount,
    feedbackCount,
    attachments,
    sharedPost,
    sharedAuthor,
    sharedAttachments,
    work,
  };
}

async function findLinkedWork(db: Db, workId: string) {
  const [work] = await db.select().from(works).where(eq(works.id, workId));
  return work && !work.deletedAt ? work : null;
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
 * `null` si l'index unique a rejeté l'insertion : deux requêtes simultanées
 * passent toutes deux la vérification de la route, seul l'index tranche.
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
