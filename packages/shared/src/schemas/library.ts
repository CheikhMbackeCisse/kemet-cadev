import { z } from "zod";
import { feedProjectSchema } from "./project.js";
import { skillSummarySchema } from "./skill.js";

/** Taille maximale d'un CV envoyé. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** `members` : seuls les comptes connectés voient et téléchargent le CV. */
export const cvVisibilitySchema = z.enum(["public", "members"]);

export type CvVisibility = z.infer<typeof cvVisibilitySchema>;

export const updateCvSchema = z.object({ visibility: cvVisibilitySchema });

export const cvSchema = z.object({
  originalName: z.string(),
  byteSize: z.number().int().nonnegative(),
  visibility: cvVisibilitySchema,
  updatedAt: z.string().datetime(),
  /** Faux pour un visiteur quand le CV est réservé aux comptes connectés. */
  available: z.boolean(),
});

export type Cv = z.infer<typeof cvSchema>;

/**
 * Bibliothèque d'un profil. Les travaux ne sont pas repris : ils ont leur
 * propre liste paginée (`GET /api/users/:handle/works`).
 */
export const profileLibrarySchema = z.object({
  cv: cvSchema.nullable(),
  projects: z.array(feedProjectSchema),
  skills: z.array(skillSummarySchema),
});

export type ProfileLibrary = z.infer<typeof profileLibrarySchema>;
