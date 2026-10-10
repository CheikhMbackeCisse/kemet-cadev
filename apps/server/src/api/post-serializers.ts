import type { postFeedback, postReplies, posts, profiles } from "@kemet/db";
import type { PostFeedbackEntry, PostReply, PostSummary, SharedPostPreview } from "@kemet/shared";

type PostRow = typeof posts.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type PostReplyRow = typeof postReplies.$inferSelect;
type PostFeedbackRow = typeof postFeedback.$inferSelect;

export function serializeSharedPostPreview(row: PostRow, author: ProfileRow): SharedPostPreview {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    body: deleted ? "" : row.body,
    format: deleted ? null : row.format,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializePostSummary(
  row: PostRow,
  author: ProfileRow,
  counts: { utileCount: number; reactedByMe: boolean; replyCount: number; feedbackCount: number },
  sharedPost: { row: PostRow; author: ProfileRow } | null,
): PostSummary {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    body: deleted ? "" : row.body,
    format: row.format,
    testUrl: deleted ? null : row.testUrl,
    testAsk: deleted ? null : row.testAsk,
    sharedPost: sharedPost ? serializeSharedPostPreview(sharedPost.row, sharedPost.author) : null,
    utileCount: counts.utileCount,
    reactedByMe: counts.reactedByMe,
    replyCount: counts.replyCount,
    feedbackCount: counts.feedbackCount,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function serializePostReply(row: PostReplyRow, author: ProfileRow): PostReply {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    body: deleted ? "" : row.body,
    isSolution: row.isSolution,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function serializePostFeedbackEntry(row: PostFeedbackRow, author: ProfileRow): PostFeedbackEntry {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
