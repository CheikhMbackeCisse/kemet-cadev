import { z } from "zod";
import { levelSchema } from "./points.js";
import { handleSchema } from "./profile.js";

export const MAX_WORK_TITLE_LENGTH = 140;
export const MAX_WORK_SUMMARY_LENGTH = 6000;
export const MAX_WORK_TAGS = 10;
export const MAX_WORK_STACK_ITEMS = 12;
export const MAX_WORK_LINKS = 8;
export const MAX_WORK_COAUTHORS = 10;
export const MAX_WORK_EXTERNAL_AUTHORS = 10;
export const MAX_WORK_MATCH_SUGGESTIONS = 5;
export const MAX_WORK_MATCH_JUSTIFICATION_LENGTH = 300;

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const workTypeSchema = z.enum([
  "class_project",
  "internship",
  "thesis_research",
  "application",
  "article",
  "other",
]);
export type WorkType = z.infer<typeof workTypeSchema>;

export const workLinkTypeSchema = z.enum([
  "github",
  "gitlab",
  "drive",
  "site",
  "video",
  "article",
  "other",
]);
export type WorkLinkType = z.infer<typeof workLinkTypeSchema>;

export const workStatusSchema = z.enum(["completed", "in_progress"]);
export type WorkStatus = z.infer<typeof workStatusSchema>;

export const workAuthorStatusSchema = z.enum(["pending", "accepted", "declined"]);
export type WorkAuthorStatus = z.infer<typeof workAuthorStatusSchema>;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Plus strict que `httpUrlSchema` : un lien de travail est toujours en https. */
export function httpsUrlSchema(maxLength: number) {
  // Normalisée par l'analyseur d'URL : "HTTPS://" passerait sinon la
  // validation puis serait refusé par la contrainte en base.
  return z
    .string()
    .max(maxLength)
    .refine(isHttpsUrl, "Lien https uniquement.")
    .transform((value) => new URL(value).href);
}

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((value) => value.toLowerCase());

export const workLinkInputSchema = z.object({
  type: workLinkTypeSchema,
  url: httpsUrlSchema(500),
  label: z.string().trim().max(60).nullable().optional(),
});
export type WorkLinkInput = z.infer<typeof workLinkInputSchema>;

const workFieldsSchema = z.object({
  title: z.string().trim().min(3).max(MAX_WORK_TITLE_LENGTH),
  type: workTypeSchema,
  status: workStatusSchema.default("completed"),
  summary: z.string().trim().min(20).max(MAX_WORK_SUMMARY_LENGTH),
  tags: z.array(tagSchema).max(MAX_WORK_TAGS).default([]),
  stack: z.array(z.string().trim().min(1).max(30)).max(MAX_WORK_STACK_ITEMS).default([]),
  year: z.number().int().min(1950).max(2100).nullable().optional(),
  institution: z.string().trim().max(120).nullable().optional(),
  links: z.array(workLinkInputSchema).max(MAX_WORK_LINKS).default([]),
  externalAuthors: z
    .array(z.string().trim().min(2).max(80))
    .max(MAX_WORK_EXTERNAL_AUTHORS)
    .default([]),
  attachmentId: z.string().uuid().nullable().optional(),
});

export const createWorkSchema = workFieldsSchema.extend({
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(slugPattern, "Lettres minuscules, chiffres et tirets seulement."),
  // Sans cette case cochée, rien n'est publié : refusé ici et en base.
  publishRightConfirmed: z.literal(true),
  coauthorHandles: z.array(handleSchema).max(MAX_WORK_COAUTHORS).default([]),
});
export type CreateWorkInput = z.input<typeof createWorkSchema>;

// Les coauteurs se gèrent par leurs propres routes (inviter, retirer), pour
// qu'un statut "accepté" ne soit jamais écrasé par un formulaire.
export const updateWorkSchema = workFieldsSchema.partial();
export type UpdateWorkInput = z.input<typeof updateWorkSchema>;

export const inviteWorkCoauthorSchema = z.object({ handle: handleSchema });
export type InviteWorkCoauthorInput = z.infer<typeof inviteWorkCoauthorSchema>;

export const decideWorkInvitationSchema = z.object({ accepted: z.boolean() });
export type DecideWorkInvitationInput = z.infer<typeof decideWorkInvitationSchema>;

export const workSortSchema = z.enum(["recent", "discussed"]);
export type WorkSort = z.infer<typeof workSortSchema>;

export const workListQuerySchema = z.object({
  /** Titre, sujet, tag, technologie ou nom d'un auteur. */
  q: z.string().trim().min(1).max(100).optional(),
  type: workTypeSchema.optional(),
  status: workStatusSchema.optional(),
  sort: workSortSchema.default("recent"),
  tag: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((value) => value.toLowerCase())
    .optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type WorkListQuery = z.infer<typeof workListQuerySchema>;

export const workPersonSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  country: z.string(),
  level: levelSchema,
});
export type WorkPerson = z.infer<typeof workPersonSchema>;

export const workSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  type: workTypeSchema,
  status: workStatusSchema,
  excerpt: z.string(),
  tags: z.array(z.string()),
  stack: z.array(z.string()),
  year: z.number().int().nullable(),
  institution: z.string().nullable(),
  publisher: workPersonSchema,
  /** Coauteurs ayant accepté, jamais une invitation en attente. */
  coauthors: z.array(workPersonSchema),
  externalAuthors: z.array(z.string()),
  hasPdf: z.boolean(),
  /** Messages de la discussion, pour le tri "les plus discutés". */
  messageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type WorkSummary = z.infer<typeof workSummarySchema>;

export const workLinkSchema = z.object({
  id: z.string().uuid(),
  type: workLinkTypeSchema,
  url: z.string(),
  label: z.string().nullable(),
});
export type WorkLink = z.infer<typeof workLinkSchema>;

export const workAttachmentSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string(),
  byteSize: z.number().int().nonnegative(),
});
export type WorkAttachment = z.infer<typeof workAttachmentSchema>;

export const workInvitationEntrySchema = z.object({
  person: workPersonSchema,
  status: workAuthorStatusSchema,
});
export type WorkInvitationEntry = z.infer<typeof workInvitationEntrySchema>;

export const workViewerRoleSchema = z.enum(["publisher", "coauthor", "invited"]);
export type WorkViewerRole = z.infer<typeof workViewerRoleSchema>;

export const workDetailSchema = workSummarySchema.extend({
  summary: z.string(),
  publisherLevel: levelSchema,
  links: z.array(workLinkSchema),
  attachment: workAttachmentSchema.nullable(),
  /** Toutes les invitations et leur statut, pour le publieur seulement ; `null` pour tout autre lecteur. */
  invitations: z.array(workInvitationEntrySchema).nullable(),
  viewerRole: workViewerRoleSchema.nullable(),
  /** Salon public de la discussion ; `null` si la publication l'a précédé. */
  discussionChannelId: z.string().uuid().nullable(),
  participantCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type WorkDetail = z.infer<typeof workDetailSchema>;

export const profileWorkSchema = workSummarySchema.extend({
  relation: z.enum(["published", "coauthored"]),
});
export type ProfileWork = z.infer<typeof profileWorkSchema>;

export const pendingWorkInvitationSchema = z.object({
  work: workSummarySchema,
  invitedAt: z.string().datetime(),
});
export type PendingWorkInvitation = z.infer<typeof pendingWorkInvitationSchema>;

export const workMatchSubjectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("work"), slug: z.string().min(1).max(80) }),
  z.object({ type: z.literal("project"), slug: z.string().min(1).max(80) }),
  z.object({ type: z.literal("post"), id: z.string().uuid() }),
]);
export type WorkMatchSubject = z.infer<typeof workMatchSubjectSchema>;

export const workMatchRequestSchema = z.object({ subject: workMatchSubjectSchema });
export type WorkMatchRequestInput = z.infer<typeof workMatchRequestSchema>;

/**
 * `assistant` : choix et justifications de @kemet. `recorded` : réponse de
 * démonstration enregistrée. `full_text` : recherche plein texte seule, sans
 * l'assistant (fournisseurs saturés, quota atteint ou réponse refusée).
 */
export const workMatchModeSchema = z.enum(["assistant", "recorded", "full_text"]);
export type WorkMatchMode = z.infer<typeof workMatchModeSchema>;

export const workMatchFallbackReasonSchema = z.enum([
  "unavailable",
  "quota_exceeded",
  "invalid_response",
]);
export type WorkMatchFallbackReason = z.infer<typeof workMatchFallbackReasonSchema>;

export const workMatchSuggestionSchema = z.object({
  person: workPersonSchema,
  work: z.object({ slug: z.string(), title: z.string(), type: workTypeSchema }),
  justification: z.string().nullable(),
});
export type WorkMatchSuggestion = z.infer<typeof workMatchSuggestionSchema>;

export const workMatchResultSchema = z.object({
  mode: workMatchModeSchema,
  fallbackReason: workMatchFallbackReasonSchema.nullable(),
  suggestions: z.array(workMatchSuggestionSchema).max(MAX_WORK_MATCH_SUGGESTIONS),
});
export type WorkMatchResult = z.infer<typeof workMatchResultSchema>;

/**
 * Réponse attendue du modèle, validée avant tout affichage. Les identifiants
 * sont ensuite comparés à la présélection : un identifiant inventé est rejeté.
 */
export const workMatchModelOutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        workId: z.string().min(1).max(10),
        handle: z.string().min(1).max(40),
        justification: z.string().trim().min(1).max(MAX_WORK_MATCH_JUSTIFICATION_LENGTH),
      }),
    )
    .max(MAX_WORK_MATCH_SUGGESTIONS),
});
export type WorkMatchModelOutput = z.infer<typeof workMatchModelOutputSchema>;
