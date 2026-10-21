import type { postAttachments, postFeedback, postReplies, posts, profiles } from "@kemet/db";
import type { Attachment, PostFeedbackEntry, PostReply, PostSummary, SharedPostPreview } from "@kemet/shared";

type PostRow = typeof posts.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type PostReplyRow = typeof postReplies.$inferSelect;
type PostFeedbackRow = typeof postFeedback.$inferSelect;
type PostAttachmentRow = typeof postAttachments.$inferSelect;

export function serializePostAttachment(row: PostAttachmentRow): Attachment {
  return {
    id: row.id,
    kind: "image",
    mimeType: row.mimeType,
    originalName: row.originalName,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSharedPostPreview(
  row: PostRow,
  author: ProfileRow,
  attachments: PostAttachmentRow[],
): SharedPostPreview {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    body: deleted ? "" : row.body,
    format: deleted ? null : row.format,
    attachments: deleted ? [] : attachments.map(serializePostAttachment),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializePostSummary(
  row: PostRow,
  author: ProfileRow,
  counts: { utileCount: number; reactedByMe: boolean; replyCount: number; feedbackCount: number },
  attachments: PostAttachmentRow[],
  sharedPost: { row: PostRow; author: ProfileRow; attachments: PostAttachmentRow[] } | null,
): PostSummary {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    body: deleted ? "" : row.body,
    format: row.format,
    testUrl: deleted ? null : row.testUrl,
    testAsk: deleted ? null : row.testAsk,
    attachments: deleted ? [] : attachments.map(serializePostAttachment),
    sharedPost: sharedPost
      ? serializeSharedPostPreview(sharedPost.row, sharedPost.author, sharedPost.attachments)
      : null,
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
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
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
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
