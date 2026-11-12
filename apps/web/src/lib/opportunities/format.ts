import { COUNTRIES, type OpportunitySummary } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

const AMOUNT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
// Dates de l'offre lues telles qu'écrites (AAAA-MM-JJ), sans décalage horaire.
const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const COUNTRY_NAMES = new Map(COUNTRIES.map((country) => [country.code, country.name]));

export function formatFcfa(amount: number): string {
  return AMOUNT.format(amount);
}

export function formatOfferDate(isoDate: string): string {
  return DATE.format(new Date(`${isoDate}T00:00:00Z`));
}

export function countryName(code: string): string {
  return COUNTRY_NAMES.get(code) ?? code;
}

/** "Dakar, Sénégal", "Sénégal", ou "À distance". */
export function locationLabel(
  offer: Pick<OpportunitySummary, "remote" | "countryCode" | "city">,
): string {
  if (offer.remote && !offer.countryCode) return fr.opportunities.remote;
  const place = [offer.city, offer.countryCode ? countryName(offer.countryCode) : null]
    .filter(Boolean)
    .join(", ");
  return offer.remote ? `${place} · ${fr.opportunities.remote}` : place;
}

/** Le chiffre qui compte pour choisir : rémunération, budget, ou rien. */
export function moneyLabel(
  offer: Pick<OpportunitySummary, "kind" | "compensationFcfa" | "budgetMinFcfa" | "budgetMaxFcfa">,
): string | null {
  if (offer.kind === "mission" && offer.budgetMinFcfa !== null && offer.budgetMaxFcfa !== null) {
    return fr.opportunities.budget(
      formatFcfa(offer.budgetMinFcfa),
      formatFcfa(offer.budgetMaxFcfa),
    );
  }
  if (offer.compensationFcfa !== null)
    return fr.opportunities.perMonth(formatFcfa(offer.compensationFcfa));
  return null;
}

/** "Réponse avant le 29 novembre 2026", ou "Clôturée le…" une fois passée. */
export function deadlineLabel(
  offer: Pick<OpportunitySummary, "deadline" | "closed">,
): string | null {
  if (!offer.deadline) return null;
  const date = formatOfferDate(offer.deadline);
  return offer.closed ? fr.opportunities.closedOn(date) : fr.opportunities.deadline(date);
}

/** "CDI", "Stage", ou le type d'offre pour une mission. */
export function kindLabel(offer: Pick<OpportunitySummary, "kind" | "contractType">): string {
  if (offer.kind === "job" && offer.contractType) {
    return `${fr.opportunities.kinds.job} · ${fr.opportunities.contracts[offer.contractType]}`;
  }
  return fr.opportunities.kinds[offer.kind];
}
