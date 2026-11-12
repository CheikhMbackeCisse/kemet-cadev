import type { postAttachments, postFeedback, postReplies, posts, profiles, works } from "@kemet/db";
import { serializePostWorkPreview } from "./work-serializers.js";
import type {
  AssistantInvocationDetail,
  Attachment,
  Level,
  PostFeedbackEntry,
  PostReply,
  PostSummary,
  SharedPostPreview,
} from "@kemet/shared";

type PostRow = typeof posts.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type PostReplyRow = typeof postReplies.$inferSelect;
type PostFeedbackRow = typeof postFeedback.$inferSelect;
type PostAttachmentRow = typeof postAttachments.$inferSelect;

/** `removed` : l'auteur a supprimé son compte, le fichier n'existe plus sur le disque. */
export function serializePostAttachment(row: PostAttachmentRow, removed = false): Attachment {
  return {
    id: row.id,
    kind: "image",
    mimeType: row.mimeType,
    originalName: row.originalName,
    byteSize: row.byteSize,
    durationMs: null,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    removed,
  };
}

export function serializeSharedPostPreview(
  row: PostRow,
  author: ProfileRow,
  authorLevel: Level,
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
    authorLevel,
    body: deleted ? "" : row.body,
    format: deleted ? null : row.format,
    attachments: deleted
      ? []
      : attachments.map((attachment) =>
          serializePostAttachment(attachment, author.deletedAt !== null),
        ),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializePostSummary(
  row: PostRow,
  author: ProfileRow,
  authorLevel: Level,
  counts: {
    utileCount: number;
    reactedByMe: boolean;
    savedByMe: boolean;
    replyCount: number;
    feedbackCount: number;
    repostCount: number;
    repostedByMe: boolean;
    authorFollowedByMe: boolean;
  },
  attachments: PostAttachmentRow[],
  sharedPost: {
    row: PostRow;
    author: ProfileRow;
    authorLevel: Level;
    attachments: PostAttachmentRow[];
  } | null,
  work: typeof works.$inferSelect | null = null,
): PostSummary {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    authorLevel,
    body: deleted ? "" : row.body,
    format: row.format,
    testUrl: deleted ? null : row.testUrl,
    testAsk: deleted ? null : row.testAsk,
    isBeginner: row.isBeginner,
    attachments: deleted
      ? []
      : attachments.map((attachment) =>
          serializePostAttachment(attachment, author.deletedAt !== null),
        ),
    mediaCredit:
      row.mediaCredit && !deleted ? { label: row.mediaCredit, url: row.mediaCreditUrl } : null,
    sharedPost: sharedPost
      ? serializeSharedPostPreview(
          sharedPost.row,
          sharedPost.author,
          sharedPost.authorLevel,
          sharedPost.attachments,
        )
      : null,
    work: work && !deleted ? serializePostWorkPreview(work) : null,
    utileCount: counts.utileCount,
    reactedByMe: counts.reactedByMe,
    savedByMe: counts.savedByMe,
    replyCount: counts.replyCount,
    feedbackCount: counts.feedbackCount,
    repostCount: counts.repostCount,
    repostedByMe: counts.repostedByMe,
    authorFollowedByMe: counts.authorFollowedByMe,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function serializePostReply(
  row: PostReplyRow,
  author: ProfileRow,
  authorLevel: Level,
  assistant: AssistantInvocationDetail | null = null,
): PostReply {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    authorLevel,
    body: deleted ? "" : row.body,
    isSolution: row.isSolution,
    assistant,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function serializePostFeedbackEntry(
  row: PostFeedbackRow,
  author: ProfileRow,
  authorLevel: Level,
): PostFeedbackEntry {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    authorLevel,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}
