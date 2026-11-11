import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  follows,
  postBookmarks,
  postFeedback,
  postReactions,
  postReplies,
  postReposts,
  posts,
  profiles,
  works,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import type { CreatePostInput } from "@kemet/shared";
import { badRequest } from "../../errors.js";
import { findProfileById } from "./chat.js";
import { listAttachmentsForPosts } from "./post-attachments.js";
import { notWrittenByFiller } from "./fillers.js";

// Fenêtre du classement "Pour toi" : "Utile" et retours de test sur les
// posts récents, sans pondération par niveau (docs/adr/0010-fil-de-posts.md).
const POUR_TOI_WINDOW_DAYS = 14;
const TALENT_WORK_BONUS = 6;
const TALENT_CODE_PENALTY = 4;
// Débutants (isBeginnerAudience) : un post marqué débutant passe devant, sans
// rien afficher de plus.
const BEGINNER_POST_BONUS = 6;
const CODE_FENCE = "```";

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
    isBeginner?: boolean;
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
      isBeginner: input.isBeginner ?? false,
    })
    .returning();
  return post!;
}

/** Un post écrit par un figurant du seed n'existe pour personne, en lecture comme en écriture. */
export async function findPostById(db: Db, postId: string) {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), notWrittenByFiller(posts.authorId)));
  return post ?? null;
}

export async function editPost(db: Db, postId: string, body: string) {
  const [post] = await db
    .update(posts)
    .set({ body, editedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning();
  return post!;
}

export async function softDeletePost(db: Db, postId: string) {
  const [post] = await db
    .update(posts)
    .set({ deletedAt: new Date() })
    .where(eq(posts.id, postId))
    .returning();
  return post!;
}

export async function listFolloweeIds(db: Db, profileId: string) {
  const rows = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, profileId));
  return rows.map((row) => row.id);
}

// Sous-requête plutôt qu'une liste d'identifiants : un paramètre par
// abonnement finirait par dépasser la limite de Postgres.
function followedOrSelf(viewerProfileId: string) {
  return sql`select ${follows.followeeId} from ${follows} where ${follows.followerId} = ${viewerProfileId}
    union all select ${viewerProfileId}::uuid`;
}

/**
 * Posts écrits ou republiés par soi et par les personnes suivies, rangés par
 * la date de la dernière activité (publication ou republication), qui sert
 * aussi de curseur. Un post republié par plusieurs personnes n'apparaît qu'une fois.
 */
export async function listAbonnementsFeed(
  db: Db,
  viewerProfileId: string,
  cursor: string | undefined,
  limit: number,
) {
  const sourceList = followedOrSelf(viewerProfileId);
  const before = cursor ? parseCursorDate(cursor) : null;
  const activity = sql`(
    select "activity"."post_id", max("activity"."activity_at") as "activity_at"
    from (
      select ${posts.id} as "post_id", ${posts.createdAt} as "activity_at"
      from ${posts} where ${posts.authorId} in (${sourceList})
      union all
      select ${postReposts.postId}, ${postReposts.createdAt}
      from ${postReposts}
      where ${postReposts.profileId} in (${sourceList})
        and ${notWrittenByFiller(postReposts.profileId)}
    ) as "activity"
    group by "activity"."post_id"
  )`;
  const result = await db.execute<{ post_id: string; activity_ms: number | string }>(sql`
    select "feed"."post_id",
      (extract(epoch from "feed"."activity_at") * 1000)::float8 as "activity_ms"
    from ${activity} as "feed"
    join ${posts} on ${posts.id} = "feed"."post_id"
    where ${posts.deletedAt} is null
      and ${notWrittenByFiller(posts.authorId)}
      ${before ? sql`and "feed"."activity_at" < ${before.toISOString()}::timestamp` : sql``}
    order by "feed"."activity_at" desc, "feed"."post_id" desc
    limit ${limit + 1}
  `);
  const ordered = [...result].map((row) => ({
    postId: row.post_id,
    // Lu en millisecondes : un horodatage sans fuseau rendu en texte serait
    // relu dans le fuseau local par new Date.
    createdAt: new Date(Math.floor(Number(row.activity_ms))),
  }));
  const page = toPage(ordered, limit);
  const rows = await findPostsByIdsInOrder(
    db,
    page.items.map((item) => item.postId),
  );
  return { items: rows, nextCursor: page.nextCursor };
}

async function findPostsByIdsInOrder(db: Db, postIds: string[]) {
  if (postIds.length === 0) return [];
  const rows = await db.select().from(posts).where(inArray(posts.id, postIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return postIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

/**
 * Pour chaque post, la personne suivie (ou soi) qui l'a republié le plus
 * récemment : la ligne "a republié" au-dessus du post dans le fil.
 */
export async function findLatestRepostersAmongSources(
  db: Db,
  viewerProfileId: string,
  postIds: string[],
) {
  if (postIds.length === 0)
    return new Map<string, { profileId: string; handle: string; displayName: string }>();
  const rows = await db
    .selectDistinctOn([postReposts.postId], {
      postId: postReposts.postId,
      profileId: profiles.id,
      handle: profiles.handle,
      displayName: profiles.displayName,
    })
    .from(postReposts)
    .innerJoin(profiles, eq(profiles.id, postReposts.profileId))
    .where(
      and(
        inArray(postReposts.postId, postIds),
        sql`${postReposts.profileId} in (${followedOrSelf(viewerProfileId)})`,
        isNull(profiles.deletedAt),
        eq(profiles.isFiller, false),
      ),
    )
    .orderBy(postReposts.postId, desc(postReposts.createdAt));
  return new Map(
    rows.map((row) => [
      row.postId,
      { profileId: row.profileId, handle: row.handle, displayName: row.displayName },
    ]),
  );
}

/** Posts marqués "Débutant", du plus récent au plus ancien : filtre "Pour débuter". */
export async function listBeginnerFeed(db: Db, cursor: string | undefined, limit: number) {
  const visible = and(
    isNull(posts.deletedAt),
    eq(posts.isBeginner, true),
    notWrittenByFiller(posts.authorId),
  );
  const condition = cursor ? and(visible, lt(posts.createdAt, new Date(cursor))) : visible;
  const rows = await db
    .select()
    .from(posts)
    .where(condition)
    .orderBy(desc(posts.createdAt))
    .limit(limit + 1);
  return toPage(rows, limit);
}

/**
 * Liste bornée, sans curseur : le score n'est pas monotone avec la date, un
 * curseur stable demanderait de figer le score au premier chargement.
 */
export async function listPourToiFeed(
  db: Db,
  limit: number,
  options: { talent?: boolean; beginner?: boolean } = {},
) {
  const since = new Date(Date.now() - POUR_TOI_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // RH et entrepreneurs (prefersTalentFeed) : un travail annoncé passe devant,
  // un post qui contient un bloc de code recule. Les profils ouverts aux
  // opportunités et les projets ont leurs propres cartes dans le fil.
  const talentBonus = options.talent
    ? sql` + (case when ${posts.workId} is not null then ${TALENT_WORK_BONUS} else 0 end)
        - (case when strpos(${posts.body}, ${CODE_FENCE}) > 0 then ${TALENT_CODE_PENALTY} else 0 end)`
    : sql``;
  const beginnerBonus = options.beginner
    ? sql` + (case when ${posts.isBeginner} then ${BEGINNER_POST_BONUS} else 0 end)`
    : sql``;
  const score = sql<number>`(
    (select count(*) from ${postReactions} where ${postReactions.postId} = ${posts.id}) * 2 +
    (select count(*) from ${postFeedback} where ${postFeedback.postId} = ${posts.id}) * 3 +
    (select count(*) from ${postReposts} where ${postReposts.postId} = ${posts.id}) * 2
    ${talentBonus}
    ${beginnerBonus}
  )`;
  // Le score reste hors du select : dans une requête sur une seule table,
  // Drizzle y écrit les colonnes sans leur table et la sous-requête compterait
  // `post_reactions.post_id = post_reactions.id`. Dans le tri, il les qualifie.
  const rows = await db
    .select({ post: posts })
    .from(posts)
    .where(
      and(isNull(posts.deletedAt), gt(posts.createdAt, since), notWrittenByFiller(posts.authorId)),
    )
    .orderBy(desc(score), desc(posts.createdAt))
    .limit(limit);
  return { items: rows.map((row) => row.post), nextCursor: null as string | null };
}

export async function countPostReactions(db: DbOrTx, postId: string) {
  const rows = await db
    .select({ id: postReactions.id })
    .from(postReactions)
    .where(eq(postReactions.postId, postId));
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
  const rows = await db
    .select({ id: postFeedback.id })
    .from(postFeedback)
    .where(eq(postFeedback.postId, postId));
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
    await db
      .delete(postReactions)
      .where(and(eq(postReactions.postId, postId), eq(postReactions.profileId, profileId)));
  } else {
    await db.insert(postReactions).values({ postId, profileId }).onConflictDoNothing();
  }
  const utileCount = await countPostReactions(db, postId);
  return { utileCount, reactedByMe: !existing };
}

export async function isPostBookmarkedByProfile(db: DbOrTx, postId: string, profileId: string) {
  const [row] = await db
    .select({ postId: postBookmarks.postId })
    .from(postBookmarks)
    .where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.profileId, profileId)));
  return row != null;
}

export async function setPostBookmark(db: Db, postId: string, profileId: string, saved: boolean) {
  if (saved) {
    await db.insert(postBookmarks).values({ postId, profileId }).onConflictDoNothing();
  } else {
    await db
      .delete(postBookmarks)
      .where(and(eq(postBookmarks.postId, postId), eq(postBookmarks.profileId, profileId)));
  }
  return { savedByMe: saved };
}

export async function countPostReposts(db: DbOrTx, postId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postReposts)
    .where(eq(postReposts.postId, postId));
  return row?.count ?? 0;
}

export async function isPostRepostedByProfile(db: DbOrTx, postId: string, profileId: string) {
  const [row] = await db
    .select({ postId: postReposts.postId })
    .from(postReposts)
    .where(and(eq(postReposts.postId, postId), eq(postReposts.profileId, profileId)));
  return row != null;
}

/** Un état posé plutôt qu'une bascule, comme l'enregistrement. */
export async function setPostRepost(db: Db, postId: string, profileId: string, reposted: boolean) {
  if (reposted) {
    await db.insert(postReposts).values({ postId, profileId }).onConflictDoNothing();
  } else {
    await db
      .delete(postReposts)
      .where(and(eq(postReposts.postId, postId), eq(postReposts.profileId, profileId)));
  }
  return { repostCount: await countPostReposts(db, postId), repostedByMe: reposted };
}

async function isFollowing(db: DbOrTx, followerId: string, followeeId: string) {
  const [row] = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row != null;
}

// Un curseur illisible vaut une demande invalide, pas une erreur serveur.
function parseCursorDate(cursor: string): Date {
  const date = new Date(cursor);
  if (Number.isNaN(date.getTime())) throw badRequest("Curseur de pagination invalide.");
  return date;
}

/** Posts enregistrés, du plus récemment enregistré au plus ancien ; le curseur est la date d'enregistrement. */
export async function listBookmarkedPosts(
  db: Db,
  profileId: string,
  cursor: string | undefined,
  limit: number,
) {
  const own = and(
    eq(postBookmarks.profileId, profileId),
    isNull(posts.deletedAt),
    notWrittenByFiller(posts.authorId),
  );
  const condition = cursor ? and(own, lt(postBookmarks.createdAt, parseCursorDate(cursor))) : own;
  const rows = await db
    .select({ post: posts, savedAt: postBookmarks.createdAt })
    .from(postBookmarks)
    .innerJoin(posts, eq(posts.id, postBookmarks.postId))
    .where(condition)
    .orderBy(desc(postBookmarks.createdAt))
    .limit(limit + 1);
  const page = toPage(
    rows.map((row) => ({ ...row, createdAt: row.savedAt })),
    limit,
  );
  return { items: page.items.map((row) => row.post), nextCursor: page.nextCursor };
}

// `viewerProfileId` est `null` pour un visiteur : jamais réagi, sans requête.
export async function hydratePost(
  db: Db,
  row: typeof posts.$inferSelect,
  viewerProfileId: string | null,
) {
  const [
    author,
    utileCount,
    reactedByMe,
    savedByMe,
    replyCount,
    feedbackCount,
    repostCount,
    repostedByMe,
    authorFollowedByMe,
    sharedPost,
    attachments,
    work,
  ] = await Promise.all([
    findProfileById(db, row.authorId),
    countPostReactions(db, row.id),
    viewerProfileId ? isPostReactedByProfile(db, row.id, viewerProfileId) : Promise.resolve(false),
    viewerProfileId
      ? isPostBookmarkedByProfile(db, row.id, viewerProfileId)
      : Promise.resolve(false),
    countPostReplies(db, row.id),
    countPostFeedback(db, row.id),
    countPostReposts(db, row.id),
    viewerProfileId ? isPostRepostedByProfile(db, row.id, viewerProfileId) : Promise.resolve(false),
    viewerProfileId && viewerProfileId !== row.authorId
      ? isFollowing(db, viewerProfileId, row.authorId)
      : Promise.resolve(false),
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
    savedByMe,
    replyCount,
    feedbackCount,
    repostCount,
    repostedByMe,
    authorFollowedByMe,
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

export async function insertPostReply(
  db: Db,
  input: { postId: string; authorId: string; body: string },
) {
  const [reply] = await db.insert(postReplies).values(input).returning();
  return reply!;
}

export async function findPostReplyById(db: Db, replyId: string) {
  const [reply] = await db.select().from(postReplies).where(eq(postReplies.id, replyId));
  return reply ?? null;
}

export async function softDeletePostReply(db: Db, replyId: string) {
  const [reply] = await db
    .update(postReplies)
    .set({ deletedAt: new Date() })
    .where(eq(postReplies.id, replyId))
    .returning();
  return reply!;
}

export async function listPostReplies(
  db: Db,
  postId: string,
  cursor: string | undefined,
  limit: number,
) {
  const visible = and(eq(postReplies.postId, postId), notWrittenByFiller(postReplies.authorId));
  const condition = cursor ? and(visible, gt(postReplies.createdAt, new Date(cursor))) : visible;
  const rows = await db
    .select()
    .from(postReplies)
    .where(condition)
    .orderBy(asc(postReplies.createdAt))
    .limit(limit + 1);
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
export async function setPostReplySolution(
  db: Db,
  postId: string,
  replyId: string,
  isSolution: boolean,
) {
  return db.transaction(async (tx) => {
    if (isSolution) {
      await tx.update(postReplies).set({ isSolution: false }).where(eq(postReplies.postId, postId));
    }
    const [reply] = await tx
      .update(postReplies)
      .set({ isSolution })
      .where(eq(postReplies.id, replyId))
      .returning();
    return reply!;
  });
}

/**
 * `null` si l'index unique a rejeté l'insertion : deux requêtes simultanées
 * passent toutes deux la vérification de la route, seul l'index tranche.
 */
export async function insertPostFeedback(
  db: Db,
  input: { postId: string; authorId: string; body: string },
) {
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
    .where(and(eq(postFeedback.postId, postId), eq(profiles.isFiller, false)))
    .orderBy(desc(postFeedback.createdAt));
}

/** Réponses visibles qui précèdent `before`, de la plus ancienne à la plus récente : contexte de @kemet. */
export async function listRepliesBefore(db: Db, postId: string, before: Date, limit: number) {
  const rows = await db
    .select({ body: postReplies.body })
    .from(postReplies)
    .where(
      and(
        eq(postReplies.postId, postId),
        isNull(postReplies.deletedAt),
        lt(postReplies.createdAt, before),
        notWrittenByFiller(postReplies.authorId),
      ),
    )
    .orderBy(desc(postReplies.createdAt))
    .limit(limit);
  return rows.reverse();
}
