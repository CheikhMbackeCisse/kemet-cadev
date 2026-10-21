import { z } from "zod";
import { COUNTRY_CODES } from "../data/countries.js";
import { levelSchema } from "./points.js";
import { httpUrlSchema } from "./url.js";

export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Lettres minuscules, chiffres et tirets uniquement.");

export const countryCodeSchema = z.enum(COUNTRY_CODES);

export const stackSchema = z.array(z.string().min(1).max(40)).max(20);

export const profileRoleSchema = z.enum(["developer", "designer", "hr", "student", "project_manager", "other"]);

export type ProfileRole = z.infer<typeof profileRoleSchema>;

export const updateProfileSchema = z
  .object({
    handle: handleSchema,
    displayName: z.string().min(1).max(80),
    country: countryCodeSchema,
    role: profileRoleSchema.nullable(),
    title: z.string().max(120).nullable(),
    bio: z.string().max(500).nullable(),
    stack: stackSchema,
    githubUrl: httpUrlSchema(200).nullable(),
    openToOpportunities: z.boolean(),
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSchema = z.object({
  id: z.string().uuid(),
  handle: handleSchema,
  displayName: z.string(),
  country: countryCodeSchema,
  role: profileRoleSchema.nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  stack: z.array(z.string()),
  githubUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  openToOpportunities: z.boolean(),
  isDemo: z.boolean(),
  level: levelSchema,
  createdAt: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const profileSummarySchema = profileSchema.pick({
  id: true,
  handle: true,
  displayName: true,
  country: true,
  title: true,
  avatarUrl: true,
  isDemo: true,
});

export type ProfileSummary = z.infer<typeof profileSummarySchema>;
