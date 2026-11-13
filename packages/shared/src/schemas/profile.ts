import { z } from "zod";
import { COUNTRY_CODES } from "../data/countries.js";
import {
  ORGANIZATION_MAX_LENGTH,
  PROFILE_ROLES,
  PROFILE_WORK_MODES,
} from "../data/onboarding-values.js";
import { levelSchema } from "./points.js";
import { profileLinkSchema } from "./profile-link.js";
import { isAssistantHandle } from "./assistant.js";

export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Lettres minuscules, chiffres et tirets uniquement.");

/** Préfixe de l'identifiant donné à un profil anonymisé : jamais choisi par une personne. */
export const DELETED_ACCOUNT_HANDLE_PREFIX = "supprime-";

export function isDeletedAccountHandle(handle: string): boolean {
  return handle.startsWith(DELETED_ACCOUNT_HANDLE_PREFIX);
}

/** Profil de l'organisatrice de la CADEV 2026, posé par le seed, sans compte de connexion. */
export const SYSTALINK_HANDLE = "systalink";

/** Organisations fictives des données de démonstration : identifiants réservés comme celui de Systalink. */
export const DEMO_ORGANIZATION_HANDLES = [
  "lagune-logiciels",
  "cayor-distribution",
  "code-des-collines",
] as const;

/** Identifiants qu'aucune personne ne peut prendre : profils anonymisés, noms de l'assistant, organisations du seed. */
export function isReservedHandle(handle: string): boolean {
  return (
    isDeletedAccountHandle(handle) ||
    isAssistantHandle(handle) ||
    handle === SYSTALINK_HANDLE ||
    (DEMO_ORGANIZATION_HANDLES as readonly string[]).includes(handle)
  );
}

export const PROFILE_KINDS = ["person", "organization"] as const;
export const profileKindSchema = z.enum(PROFILE_KINDS);
export type ProfileKind = z.infer<typeof profileKindSchema>;

export const ORGANIZATION_TYPES = ["company", "school", "community", "event_organizer"] as const;
export const organizationTypeSchema = z.enum(ORGANIZATION_TYPES);
export type OrganizationType = z.infer<typeof organizationTypeSchema>;

export const countryCodeSchema = z.enum(COUNTRY_CODES);

/** Pays d'un profil : vide tant qu'il n'a pas été choisi, ou après la suppression du compte. */
export const profileCountrySchema = z.union([countryCodeSchema, z.literal("")]);

export const stackSchema = z.array(z.string().min(1).max(40)).max(20);

export const profileRoleSchema = z.enum(PROFILE_ROLES);

export type ProfileRole = z.infer<typeof profileRoleSchema>;

export const profileWorkModeSchema = z.enum(PROFILE_WORK_MODES);

export type ProfileWorkMode = z.infer<typeof profileWorkModeSchema>;

/** Établissement (études) ou entreprise, saisi librement. */
export const organizationSchema = z.string().trim().min(1).max(ORGANIZATION_MAX_LENGTH);

export const ORGANIZATION_SUGGESTIONS_LIMIT = 8;

/** Suggestions pendant la saisie : établissements des personnes qui étudient, ou entreprises. */
export const organizationSuggestionsQuerySchema = z.object({
  kind: z.enum(["school", "company"]),
  q: z.string().trim().max(ORGANIZATION_MAX_LENGTH).default(""),
});

export const updateProfileSchema = z
  .object({
    handle: handleSchema.refine((handle) => !isReservedHandle(handle), {
      message: "Cet identifiant est réservé.",
    }),
    displayName: z.string().min(1).max(80),
    country: countryCodeSchema,
    role: profileRoleSchema.nullable(),
    workMode: profileWorkModeSchema.nullable(),
    organization: organizationSchema.nullable(),
    title: z.string().max(120).nullable(),
    bio: z.string().max(500).nullable(),
    stack: stackSchema,
    githubUrl: profileLinkSchema("github").nullable(),
    gitlabUrl: profileLinkSchema("gitlab").nullable(),
    linkedinUrl: profileLinkSchema("linkedin").nullable(),
    portfolioUrl: profileLinkSchema("portfolio").nullable(),
    websiteUrl: profileLinkSchema("website").nullable(),
    openToOpportunities: z.boolean(),
    helpsBeginners: z.boolean(),
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSchema = z.object({
  id: z.string().uuid(),
  handle: handleSchema,
  kind: profileKindSchema,
  organizationType: organizationTypeSchema.nullable(),
  displayName: z.string(),
  country: profileCountrySchema,
  role: profileRoleSchema.nullable(),
  workMode: profileWorkModeSchema.nullable(),
  organization: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  stack: z.array(z.string()),
  githubUrl: z.string().nullable(),
  gitlabUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  openToOpportunities: z.boolean(),
  helpsBeginners: z.boolean(),
  isDemo: z.boolean(),
  /** Absent pour une organisation et pour le profil de l'assistant : ni niveau, ni points. */
  level: levelSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

export const profileSummarySchema = profileSchema.pick({
  id: true,
  handle: true,
  kind: true,
  displayName: true,
  country: true,
  title: true,
  avatarUrl: true,
  helpsBeginners: true,
  isDemo: true,
});

export type ProfileSummary = z.infer<typeof profileSummarySchema>;
