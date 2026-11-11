import {
  MAX_OPPORTUNITY_CRITERIA,
  MAX_OPPORTUNITY_DOMAINS,
  type ContractType,
  type Interest,
  type OpportunityDetail,
  type OpportunityInput,
  type OpportunityKind,
} from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import type { FieldErrors } from "../forms.js";

/** Ce que le formulaire garde en mémoire : des textes, convertis à l'envoi. */
export interface OfferDraft {
  kind: OpportunityKind;
  title: string;
  organization: string;
  remote: boolean;
  countryCode: string;
  city: string;
  domains: Interest[];
  description: string;
  contractType: ContractType | "";
  startDate: string;
  compensation: string;
  budgetMin: string;
  budgetMax: string;
  deadline: string;
  criteria: string;
}

export type OfferField =
  | "title"
  | "organization"
  | "countryCode"
  | "domains"
  | "description"
  | "contractType"
  | "startDate"
  | "compensation"
  | "budgetMin"
  | "budgetMax"
  | "deadline"
  | "criteria";

export const EMPTY_OFFER_DRAFT: OfferDraft = {
  kind: "job",
  title: "",
  organization: "",
  remote: false,
  countryCode: "",
  city: "",
  domains: [],
  description: "",
  contractType: "",
  startDate: "",
  compensation: "",
  budgetMin: "",
  budgetMax: "",
  deadline: "",
  criteria: "",
};

export function draftFromOffer(offer: OpportunityDetail): OfferDraft {
  return {
    kind: offer.kind,
    title: offer.title,
    organization: offer.organization,
    remote: offer.remote,
    countryCode: offer.countryCode ?? "",
    city: offer.city ?? "",
    domains: offer.domains as Interest[],
    description: offer.description,
    contractType: offer.contractType ?? "",
    startDate: offer.startDate ?? "",
    compensation: offer.compensationFcfa === null ? "" : String(offer.compensationFcfa),
    budgetMin: offer.budgetMinFcfa === null ? "" : String(offer.budgetMinFcfa),
    budgetMax: offer.budgetMaxFcfa === null ? "" : String(offer.budgetMaxFcfa),
    deadline: offer.deadline ?? "",
    criteria: offer.criteria.join("\n"),
  };
}

/** "1 500 000" ou "1500000" : un entier, `null` si vide, `NaN` si illisible. */
export function parseAmount(value: string): number | null {
  const compact = value.replace(/[\s\u202f\u00a0.]/g, "");
  if (compact === "") return null;
  return /^\d{1,10}$/.test(compact) ? Number(compact) : Number.NaN;
}

function splitCriteria(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, MAX_OPPORTUNITY_CRITERIA);
}

/** Les mêmes règles que le serveur, dites sous chaque champ ; l'entrée n'existe que sans erreur. */
export function buildOfferInput(draft: OfferDraft): {
  input: OpportunityInput | null;
  errors: FieldErrors<OfferField>;
} {
  const errors: FieldErrors<OfferField> = {};
  const messages = fr.opportunities.errors;
  if (draft.title.trim().length < 5) errors.title = messages.title;
  if (draft.organization.trim().length < 2) errors.organization = messages.organization;
  if (!draft.remote && !draft.countryCode) errors.countryCode = messages.country;
  if (draft.domains.length === 0 || draft.domains.length > MAX_OPPORTUNITY_DOMAINS) errors.domains = messages.domains;
  if (draft.description.trim().length < 20) errors.description = messages.description;

  const isMission = draft.kind === "mission";
  const compensation = parseAmount(draft.compensation);
  const budgetMin = parseAmount(draft.budgetMin);
  const budgetMax = parseAmount(draft.budgetMax);
  const criteria = splitCriteria(draft.criteria);
  const contractType: ContractType | null =
    draft.kind === "internship" ? "stage" : isMission ? null : draft.contractType || null;

  if (isMission) {
    if (budgetMin === null || Number.isNaN(budgetMin)) errors.budgetMin = messages.amount;
    if (budgetMax === null || Number.isNaN(budgetMax)) errors.budgetMax = messages.amount;
    else if (budgetMin !== null && budgetMin > budgetMax) errors.budgetMax = messages.budgetOrder;
    if (!draft.deadline) errors.deadline = messages.deadline;
    if (criteria.length === 0) errors.criteria = messages.criteria;
  } else {
    if (!contractType) errors.contractType = messages.contract;
    if (!draft.startDate) errors.startDate = messages.startDate;
    if (compensation !== null && Number.isNaN(compensation)) errors.compensation = messages.amount;
  }

  if (Object.keys(errors).length > 0) return { input: null, errors };
  return {
    errors,
    input: {
      kind: draft.kind,
      title: draft.title.trim(),
      organization: draft.organization.trim(),
      remote: draft.remote,
      countryCode: draft.countryCode || null,
      city: draft.city.trim() || null,
      domains: draft.domains,
      description: draft.description.trim(),
      contractType,
      startDate: isMission ? null : draft.startDate,
      compensationFcfa: isMission ? null : compensation,
      budgetMinFcfa: isMission ? budgetMin : null,
      budgetMaxFcfa: isMission ? budgetMax : null,
      deadline: draft.deadline || null,
      criteria: isMission ? criteria : [],
    },
  };
}
