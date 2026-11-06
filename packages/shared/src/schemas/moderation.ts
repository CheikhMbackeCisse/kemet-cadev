import { z } from "zod";

export const reportTargetSchema = z.enum(["message", "post", "profile", "work", "conversation"]);
export type ReportTarget = z.infer<typeof reportTargetSchema>;

export const reportStatusSchema = z.enum(["pending", "resolved", "dismissed"]);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const moderationActionSchema = z.enum([
  "content_hidden",
  "account_suspended",
  "account_reinstated",
  "report_dismissed",
]);
export type ModerationAction = z.infer<typeof moderationActionSchema>;

export const MAX_REPORT_REASON_LENGTH = 500;

export const createReportSchema = z.object({
  targetType: reportTargetSchema,
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(MAX_REPORT_REASON_LENGTH),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const resolveReportActionSchema = z.enum(["hide", "dismiss", "suspend"]);
export type ResolveReportAction = z.infer<typeof resolveReportActionSchema>;

export const resolveReportSchema = z.object({
  action: resolveReportActionSchema,
  reason: z.string().max(MAX_REPORT_REASON_LENGTH).optional(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;

// Résumé de la cible calculé côté serveur (texte tronqué pour un message ou
// un post, titre pour un travail, handle pour un profil) : le client n'a jamais besoin de refaire
// cette résolution lui-même.
export const reportSchema = z.object({
  id: z.string().uuid(),
  reporterHandle: z.string(),
  targetType: reportTargetSchema,
  targetId: z.string().uuid(),
  targetSummary: z.string(),
  reason: z.string(),
  status: reportStatusSchema,
  createdAt: z.string().datetime(),
});

export type Report = z.infer<typeof reportSchema>;

export const moderationActionEntrySchema = z.object({
  id: z.string().uuid(),
  actorHandle: z.string(),
  action: moderationActionSchema,
  targetType: reportTargetSchema,
  targetId: z.string().uuid(),
  targetSummary: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type ModerationActionEntry = z.infer<typeof moderationActionEntrySchema>;
