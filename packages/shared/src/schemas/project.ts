import { z } from "zod";
import { levelSchema } from "./points.js";
import { httpUrlSchema } from "./url.js";

export const MAX_PROJECT_STACK_ITEMS = 12;
export const MAX_HELP_REQUEST_STACK_ITEMS = 12;

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const helpRequestKindSchema = z.enum(["help", "collaboration"]);
export const helpRequestStatusSchema = z.enum(["open", "closed"]);
export const applicationStatusSchema = z.enum(["pending", "accepted", "declined"]);

export type HelpRequestKind = z.infer<typeof helpRequestKindSchema>;
export type HelpRequestStatus = z.infer<typeof helpRequestStatusSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const createProjectSchema = z.object({
  slug: z.string().min(3).max(60).regex(slugPattern, "Lettres minuscules, chiffres et tirets seulement."),
  name: z.string().min(2).max(80),
  pitch: z.string().min(10).max(200),
  description: z.string().max(4000).optional().default(""),
  repoUrl: httpUrlSchema(500),
  demoUrl: httpUrlSchema(500).nullable().optional(),
  stack: z.array(z.string().min(1).max(30)).max(MAX_PROJECT_STACK_ITEMS).default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().omit({ slug: true });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createHelpRequestSchema = z.object({
  kind: helpRequestKindSchema.default("help"),
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  stack: z.array(z.string().min(1).max(30)).max(MAX_HELP_REQUEST_STACK_ITEMS).default([]),
});

export type CreateHelpRequestInput = z.infer<typeof createHelpRequestSchema>;

export const createApplicationSchema = z.object({
  message: z.string().min(10).max(1000),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const decideApplicationSchema = z.object({
  accepted: z.boolean(),
});

export type DecideApplicationInput = z.infer<typeof decideApplicationSchema>;

export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  pitch: z.string(),
  stack: z.array(z.string()),
  ownerId: z.string().uuid(),
  ownerHandle: z.string(),
  ownerDisplayName: z.string(),
  ownerAvatarUrl: z.string().nullable(),
  ownerCountry: z.string(),
  openHelpRequestCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const MAX_FEED_PROJECTS = 20;

export const feedProjectsQuerySchema = z.object({
  tab: z.enum(["abonnements", "pour-toi"]).default("pour-toi"),
  limit: z.coerce.number().int().min(1).max(MAX_FEED_PROJECTS).default(6),
});

/** Carte d'un projet dans le fil : le résumé et les rôles qu'il cherche. */
export const feedProjectSchema = projectSummarySchema.extend({
  openRoles: z.array(z.object({ id: z.string().uuid(), title: z.string(), kind: helpRequestKindSchema })),
});

export type FeedProject = z.infer<typeof feedProjectSchema>;

export const projectDetailSchema = projectSummarySchema.extend({
  description: z.string(),
  repoUrl: z.string(),
  demoUrl: z.string().nullable(),
  datacloudDeployUrl: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const helpRequestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  authorId: z.string().uuid(),
  kind: helpRequestKindSchema,
  title: z.string(),
  description: z.string(),
  stack: z.array(z.string()),
  status: helpRequestStatusSchema,
  applicationCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
});

export type HelpRequest = z.infer<typeof helpRequestSchema>;

export const applicationSchema = z.object({
  id: z.string().uuid(),
  helpRequestId: z.string().uuid(),
  applicantId: z.string().uuid(),
  applicantHandle: z.string(),
  applicantDisplayName: z.string(),
  applicantLevel: levelSchema,
  message: z.string(),
  status: applicationStatusSchema,
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});

export type Application = z.infer<typeof applicationSchema>;
