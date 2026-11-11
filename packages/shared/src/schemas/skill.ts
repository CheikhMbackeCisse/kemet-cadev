import { z } from "zod";

// Le skill retenu part en entier au modèle : cette limite borne le coût d'un appel.
export const MAX_SKILL_CONTENT_LENGTH = 20_000;
export const MAX_SKILL_TAGS = 8;

export const skillVisibilitySchema = z.enum(["private", "space", "public"]);

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createSkillSchema = z
  .object({
    slug: z.string().min(3).max(60).regex(slugPattern, "Lettres minuscules, chiffres et tirets seulement."),
    name: z.string().min(3).max(60),
    description: z.string().min(10).max(200),
    content: z.string().min(1).max(MAX_SKILL_CONTENT_LENGTH),
    tags: z.array(z.string().min(1).max(30)).max(MAX_SKILL_TAGS).default([]),
    visibility: skillVisibilitySchema.default("public"),
    spaceId: z.string().uuid().nullable().optional(),
    isBeginner: z.boolean().default(false),
  })
  .refine((input) => input.visibility !== "space" || !!input.spaceId, {
    message: "Un skill limité à un espace doit préciser cet espace.",
    path: ["spaceId"],
  });

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = createSkillSchema.innerType().partial().omit({ slug: true });

export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const rateSkillSchema = z.object({
  stars: z.number().int().min(1).max(5),
});

export type RateSkillInput = z.infer<typeof rateSkillSchema>;

export const skillSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  visibility: skillVisibilitySchema,
  isBeginner: z.boolean(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  /** Début du premier bloc de code, en texte brut : couverture de la carte. */
  codeExcerpt: z.object({
    language: z.string().max(20).nullable(),
    lines: z.array(z.string().max(80)).max(6),
  }),
  averageStars: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().nonnegative(),
  /** Réponses de @kocc qui ont retenu ce skill. */
  usageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export const skillListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  /** "1" : seulement les skills marqués "Débutant". */
  beginner: z.literal("1").optional(),
});

export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const skillDetailSchema = skillSummarySchema.extend({
  content: z.string(),
  spaceId: z.string().uuid().nullable(),
});

export type SkillDetail = z.infer<typeof skillDetailSchema>;

/** Échange enregistré montré sur la page d'un skill de démonstration, sans appel au modèle. */
export const skillExampleAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export type SkillExampleAnswer = z.infer<typeof skillExampleAnswerSchema>;
