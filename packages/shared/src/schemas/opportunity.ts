import { z } from "zod";
import { levelSchema } from "./points.js";
import { AFRICAN_COUNTRY_CODES } from "../data/countries.js";
import { INTERESTS } from "../data/onboarding-values.js";

export const OPPORTUNITY_KINDS = ["job", "internship", "mission"] as const;
export const CONTRACT_TYPES = ["cdi", "cdd", "alternance", "stage", "freelance"] as const;

export const MAX_OPPORTUNITY_DOMAINS = 4;
export const MAX_OPPORTUNITY_CRITERIA = 8;
/** Plafond d'un montant en FCFA : un milliard, bien au-delà d'une mission réelle. */
export const MAX_FCFA_AMOUNT = 1_000_000_000;
export const MAX_OPPORTUNITIES_PAGE = 50;

/** Identifiants qui désignent une page de l'app sous /opportunites. */
export const RESERVED_OPPORTUNITY_SLUGS: readonly string[] = ["nouvelle"];

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const opportunityKindSchema = z.enum(OPPORTUNITY_KINDS);
export const contractTypeSchema = z.enum(CONTRACT_TYPES);
export type OpportunityKind = z.infer<typeof opportunityKindSchema>;
export type ContractType = z.infer<typeof contractTypeSchema>;

const africanCountrySchema = z
  .string()
  .refine((code) => AFRICAN_COUNTRY_CODES.includes(code), {
    message: "Choisis un pays d'Afrique.",
  });

const isoDateSchema = z
  .string()
  .regex(isoDatePattern, "Date au format AAAA-MM-JJ.")
  // Date.parse fait glisser un 31 février au 3 mars, que PostgreSQL refuse.
  .refine(
    (value) => {
      const year = Number(value.slice(0, 4));
      const date = new Date(`${value}T00:00:00Z`);
      return (
        year >= 2000 &&
        year <= 2100 &&
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    },
    { message: "Date invalide." },
  );

const fcfaSchema = z.number().int().min(0).max(MAX_FCFA_AMOUNT);

const opportunityFieldsSchema = z.object({
  kind: opportunityKindSchema,
  title: z.string().trim().min(5).max(120),
  organization: z.string().trim().min(2).max(80),
  remote: z.boolean(),
  countryCode: africanCountrySchema.nullable(),
  city: z.string().trim().max(60).nullable(),
  domains: z.array(z.enum(INTERESTS)).min(1).max(MAX_OPPORTUNITY_DOMAINS),
  description: z.string().trim().min(20).max(6000),
  contractType: contractTypeSchema.nullable(),
  startDate: isoDateSchema.nullable(),
  compensationFcfa: fcfaSchema.nullable(),
  budgetMinFcfa: fcfaSchema.nullable(),
  budgetMaxFcfa: fcfaSchema.nullable(),
  deadline: isoDateSchema.nullable(),
  criteria: z.array(z.string().trim().min(2).max(160)).max(MAX_OPPORTUNITY_CRITERIA),
});

type OpportunityFields = z.infer<typeof opportunityFieldsSchema>;

/**
 * Règles propres à chaque type, aussi posées en base par une contrainte : un
 * emploi ou un stage a un contrat et une date de début, une mission un budget
 * et une date limite. Les champs de l'autre type doivent rester vides.
 */
function checkKindRules(input: OpportunityFields, context: z.RefinementCtx) {
  const issue = (path: keyof OpportunityFields, message: string) =>
    context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (!input.remote && input.countryCode === null)
    issue("countryCode", "Choisis un pays, ou « À distance ».");
  if (input.kind === "mission") {
    if (input.budgetMinFcfa === null) issue("budgetMinFcfa", "Indique un budget minimum.");
    if (input.budgetMaxFcfa === null) issue("budgetMaxFcfa", "Indique un budget maximum.");
    if (
      input.budgetMinFcfa !== null &&
      input.budgetMaxFcfa !== null &&
      input.budgetMinFcfa > input.budgetMaxFcfa
    ) {
      issue("budgetMaxFcfa", "Le maximum doit dépasser le minimum.");
    }
    if (input.deadline === null) issue("deadline", "Indique une date limite de réponse.");
    if (input.criteria.length === 0) issue("criteria", "Indique au moins un critère.");
    if (input.contractType !== null)
      issue("contractType", "Une mission n'a pas de type de contrat.");
    if (input.startDate !== null) issue("startDate", "Une mission n'a pas de date de début.");
    if (input.compensationFcfa !== null)
      issue("compensationFcfa", "Une mission a un budget, pas une rémunération.");
    return;
  }
  if (input.contractType === null) issue("contractType", "Choisis un type de contrat.");
  if (
    input.kind === "internship" &&
    input.contractType !== null &&
    input.contractType !== "stage"
  ) {
    issue("contractType", "Un stage a un contrat de stage.");
  }
  if (input.startDate === null) issue("startDate", "Indique une date de début.");
  if (input.budgetMinFcfa !== null || input.budgetMaxFcfa !== null)
    issue("budgetMinFcfa", "Le budget est réservé aux missions.");
  if (input.criteria.length > 0) issue("criteria", "Les critères sont réservés aux missions.");
}

export const opportunityInputSchema = opportunityFieldsSchema.superRefine(checkKindRules);
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

export const createOpportunitySchema = opportunityFieldsSchema
  .extend({
    slug: z
      .string()
      .min(3)
      .max(60)
      .regex(slugPattern, "Lettres minuscules, chiffres et tirets seulement.")
      .refine((slug) => !RESERVED_OPPORTUNITY_SLUGS.includes(slug), {
        message: "Cet identifiant est réservé.",
      }),
  })
  .superRefine(checkKindRules);
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

/** Type affiché dans les filtres : les offres, plus les projets qui cherchent des membres. */
export const opportunityFilterKindSchema = z.enum([...OPPORTUNITY_KINDS, "project"] as const);
export type OpportunityFilterKind = z.infer<typeof opportunityFilterKindSchema>;

export const listOpportunitiesQuerySchema = z.object({
  kind: opportunityKindSchema.optional(),
  country: z.string().length(2).optional(),
  domain: z.enum(INTERESTS).optional(),
  includeClosed: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  author: z.string().min(1).max(30).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_OPPORTUNITIES_PAGE).default(20),
});
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>;

export const opportunitySummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  kind: opportunityKindSchema,
  title: z.string(),
  organization: z.string(),
  remote: z.boolean(),
  countryCode: z.string().nullable(),
  city: z.string().nullable(),
  domains: z.array(z.string()),
  contractType: contractTypeSchema.nullable(),
  startDate: z.string().nullable(),
  compensationFcfa: z.number().nullable(),
  budgetMinFcfa: z.number().nullable(),
  budgetMaxFcfa: z.number().nullable(),
  deadline: z.string().nullable(),
  closed: z.boolean(),
  authorId: z.string().uuid(),
  authorHandle: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  authorCountry: z.string(),
  createdAt: z.string().datetime(),
});
export type OpportunitySummary = z.infer<typeof opportunitySummarySchema>;

export const opportunityDetailSchema = opportunitySummarySchema.extend({
  authorLevel: levelSchema,
  description: z.string(),
  criteria: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
export type OpportunityDetail = z.infer<typeof opportunityDetailSchema>;

/** Une offre est clôturée le lendemain de sa date limite (dates en UTC, celle de Dakar). */
export function isOpportunityClosed(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline < today;
}

/** Date du jour au format AAAA-MM-JJ, en UTC. */
export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
