import { z } from "zod";
import { assistantInvocationDetailSchema, assistantInvocationStatusSchema } from "./assistant.js";
import { levelSchema } from "./points.js";
import { attachmentSchema, MAX_POST_ATTACHMENTS } from "./attachment.js";
import { httpUrlSchema } from "./url.js";
import { workTypeSchema } from "./work.js";

export const MAX_POST_BODY_LENGTH = 1000;
export const MAX_POST_REPLY_LENGTH = 1000;
export const MAX_POST_FEEDBACK_LENGTH = 2000;
export const MAX_POST_TEST_ASK_LENGTH = 300;

export const postFormatSchema = z.enum(["astuce", "a_tester", "question"]);

export type PostFormat = z.infer<typeof postFormatSchema>;

export const createPostSchema = z
  .object({
    body: z.string().max(MAX_POST_BODY_LENGTH),
    format: postFormatSchema.nullable().optional(),
    testUrl: httpUrlSchema(500).nullable().optional(),
    testAsk: z.string().min(1).max(MAX_POST_TEST_ASK_LENGTH).nullable().optional(),
    attachmentIds: z.array(z.string().uuid()).max(MAX_POST_ATTACHMENTS).optional(),
    isBeginner: z.boolean().optional(),
  })
  .refine((input) => input.body.trim().length > 0 || (input.attachmentIds?.length ?? 0) > 0, {
    message: "Un post doit contenir du texte ou au moins une image.",
    path: ["body"],
  })
  .refine((input) => input.format === "a_tester" || (!input.testUrl && !input.testAsk), {
    message: "Le lien et la demande de retour ne s'utilisent qu'avec le format À tester.",
    path: ["testUrl"],
  })
  .refine((input) => input.format !== "a_tester" || !!input.testUrl, {
    message: "Un post À tester doit indiquer un lien de démo ou de dépôt.",
    path: ["testUrl"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const editPostSchema = z.object({
  body: z.string().max(MAX_POST_BODY_LENGTH),
});

export type EditPostInput = z.infer<typeof editPostSchema>;

export const sharePostSchema = z.object({
  body: z.string().max(MAX_POST_BODY_LENGTH).optional().default(""),
});

export type SharePostInput = z.infer<typeof sharePostSchema>;

export const createPostReplySchema = z.object({
  body: z.string().min(1).max(MAX_POST_REPLY_LENGTH),
});

export type CreatePostReplyInput = z.infer<typeof createPostReplySchema>;

export const markPostReplySolutionSchema = z.object({
  isSolution: z.boolean(),
});

export type MarkPostReplySolutionInput = z.infer<typeof markPostReplySolutionSchema>;

export const createPostFeedbackSchema = z.object({
  body: z.string().min(1).max(MAX_POST_FEEDBACK_LENGTH),
});

export type CreatePostFeedbackInput = z.infer<typeof createPostFeedbackSchema>;

export const feedTabSchema = z.enum(["abonnements", "pour-toi", "debuter"]);

export type FeedTab = z.infer<typeof feedTabSchema>;

export const feedQuerySchema = z.object({
  tab: feedTabSchema.default("abonnements"),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const sharedPostPreviewSchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  authorCountry: z.string(),
  authorLevel: levelSchema,
  body: z.string(),
  format: postFormatSchema.nullable(),
  attachments: z.array(attachmentSchema),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type SharedPostPreview = z.infer<typeof sharedPostPreviewSchema>;

/** Travail annoncé par un post publié avec lui. */
export const postWorkPreviewSchema = z.object({
  slug: z.string(),
  title: z.string(),
  type: workTypeSchema,
  excerpt: z.string(),
});

export type PostWorkPreview = z.infer<typeof postWorkPreviewSchema>;

export const postRepostedBySchema = z.object({
  profileId: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
});

export type PostRepostedBy = z.infer<typeof postRepostedBySchema>;

export const postSummarySchema = z.object({
  id: z.string().uuid(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  authorCountry: z.string(),
  authorLevel: levelSchema,
  body: z.string(),
  format: postFormatSchema.nullable(),
  testUrl: z.string().nullable(),
  testAsk: z.string().nullable(),
  isBeginner: z.boolean(),
  attachments: z.array(attachmentSchema),
  sharedPost: sharedPostPreviewSchema.nullable(),
  work: postWorkPreviewSchema.nullable(),
  utileCount: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
  savedByMe: z.boolean(),
  replyCount: z.number().int().nonnegative(),
  feedbackCount: z.number().int().nonnegative(),
  repostCount: z.number().int().nonnegative(),
  repostedByMe: z.boolean(),
  /** Faux pour un visiteur et sur ses propres posts. */
  authorFollowedByMe: z.boolean(),
  /** Fil seulement : personne suivie (ou soi) qui a republié ce post, la plus récente. */
  repostedBy: postRepostedBySchema.nullable().optional(),
  /** Fil seulement : première réponse terminée de @kemet, affichée dépliée sous le post. */
  kemetAnswer: z.lazy(() => postReplySchema.nullable()).optional(),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
});

export type PostSummary = z.infer<typeof postSummarySchema>;

export const postReactionResultSchema = z.object({
  utileCount: z.number().int().nonnegative(),
  reactedByMe: z.boolean(),
});

export type PostReactionResult = z.infer<typeof postReactionResultSchema>;

export const postBookmarkInputSchema = z.object({ saved: z.boolean() });

export const postBookmarkResultSchema = z.object({ savedByMe: z.boolean() });

export type PostBookmarkResult = z.infer<typeof postBookmarkResultSchema>;

export const postRepostInputSchema = z.object({ reposted: z.boolean() });

export const postRepostResultSchema = z.object({
  repostCount: z.number().int().nonnegative(),
  repostedByMe: z.boolean(),
});

export type PostRepostResult = z.infer<typeof postRepostResultSchema>;

export const postReplySchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  authorCountry: z.string(),
  authorLevel: levelSchema,
  body: z.string(),
  isSolution: z.boolean(),
  /** Renseigné seulement pour une réponse de @kemet : skill cité, avis, réponse enregistrée. */
  assistant: assistantInvocationDetailSchema.nullable(),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
});

export type PostReply = z.infer<typeof postReplySchema>;

/**
 * Suite donnée à une réponse qui appelle @kemet : l'invocation lancée, ou la
 * raison immédiate du refus (quota atteint). `null` sans appel à @kemet.
 */
export const postReplyAssistantStartSchema = z.object({
  invocationId: z.string().uuid().nullable(),
  errorCode: z.string().nullable(),
});

export type PostReplyAssistantStart = z.infer<typeof postReplyAssistantStartSchema>;

export const createPostReplyResultSchema = z.object({
  reply: postReplySchema,
  assistant: postReplyAssistantStartSchema.nullable(),
});

export type CreatePostReplyResult = z.infer<typeof createPostReplyResultSchema>;

/** État d'une réponse de @kemet sous un post, lu par la personne qui l'a demandée. */
export const postAssistantStatusSchema = z.object({
  status: assistantInvocationStatusSchema,
  errorCode: z.string().nullable(),
  reply: postReplySchema.nullable(),
});

export type PostAssistantStatus = z.infer<typeof postAssistantStatusSchema>;

export const postFeedbackEntrySchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  authorCountry: z.string(),
  authorLevel: levelSchema,
  body: z.string(),
  createdAt: z.string().datetime(),
});

export type PostFeedbackEntry = z.infer<typeof postFeedbackEntrySchema>;
