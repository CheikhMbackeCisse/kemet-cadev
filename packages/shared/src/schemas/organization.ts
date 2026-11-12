import { z } from "zod";
import { countryCodeSchema, organizationTypeSchema } from "./profile.js";
import { httpUrlSchema } from "./url.js";

export const ORGANIZATION_NAME_MAX_LENGTH = 80;
export const ORGANIZATION_DESCRIPTION_MAX_LENGTH = 200;
/** Logo d'une organisation : PNG, JPEG ou WebP, 1 Mo au plus. */
export const ORGANIZATION_LOGO_MAX_BYTES = 1024 * 1024;
export const ORGANIZATION_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Champs texte d'une demande de référencement, envoyés avec le logo dans un seul formulaire multipart. */
export const organizationRequestInputSchema = z.object({
  name: z.string().trim().min(2).max(ORGANIZATION_NAME_MAX_LENGTH),
  organizationType: organizationTypeSchema,
  country: countryCodeSchema,
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .transform((value) => value || null)
    .pipe(httpUrlSchema(300).nullable()),
  description: z
    .string()
    .trim()
    .max(ORGANIZATION_DESCRIPTION_MAX_LENGTH)
    .transform((value) => value || null),
});
export type OrganizationRequestInput = z.infer<typeof organizationRequestInputSchema>;

export const organizationRequestStatusSchema = z.enum(["pending", "accepted", "refused"]);
export type OrganizationRequestStatus = z.infer<typeof organizationRequestStatusSchema>;

export const organizationRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  organizationType: organizationTypeSchema,
  country: z.string(),
  websiteUrl: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  status: organizationRequestStatusSchema,
  requesterHandle: z.string(),
  requesterDisplayName: z.string(),
  /** Identifiant de la page créée, une fois la demande acceptée. */
  organizationHandle: z.string().nullable(),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});
export type OrganizationRequest = z.infer<typeof organizationRequestSchema>;

export const decideOrganizationRequestSchema = z.object({
  decision: z.enum(["accept", "refuse"]),
});
export type DecideOrganizationRequestInput = z.infer<typeof decideOrganizationRequestSchema>;

/** Organisation au nom de laquelle la personne connectée peut publier. */
export const managedOrganizationSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  organizationType: organizationTypeSchema,
});
export type ManagedOrganization = z.infer<typeof managedOrganizationSchema>;
