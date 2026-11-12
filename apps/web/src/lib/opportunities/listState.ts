import {
  AFRICAN_COUNTRY_CODES,
  INTERESTS,
  OPPORTUNITY_KINDS,
  type OpportunityFilterKind,
} from "@kemet/shared";

// Radix refuse une valeur vide pour une option : "tout" a sa propre valeur.
export const ALL = "all";

export interface OpportunityFilterValues {
  kind: OpportunityFilterKind | typeof ALL;
  country: string;
  domain: string;
}

export interface OpportunityListState {
  filters: OpportunityFilterValues;
  includeClosed: boolean;
}

export const NO_FILTERS: OpportunityFilterValues = { kind: ALL, country: ALL, domain: ALL };

const KINDS = new Set<string>([...OPPORTUNITY_KINDS, "project"]);
const COUNTRIES = new Set<string>(AFRICAN_COUNTRY_CODES);
const DOMAINS = new Set<string>(INTERESTS.filter((interest) => interest !== "other"));

const PARAMS = { kind: "type", country: "pays", domain: "domaine", closed: "cloturees" } as const;

function pick(value: string | null, allowed: Set<string>): string {
  return value && allowed.has(value) ? value : ALL;
}

/** Filtres lus dans l'adresse : une valeur inconnue revient à "tout". */
export function readOpportunityListState(search: string): OpportunityListState {
  const params = new URLSearchParams(search);
  return {
    filters: {
      kind: pick(params.get(PARAMS.kind), KINDS) as OpportunityFilterValues["kind"],
      country: pick(params.get(PARAMS.country), COUNTRIES),
      domain: pick(params.get(PARAMS.domain), DOMAINS),
    },
    includeClosed: params.get(PARAMS.closed) === "1",
  };
}

/** Adresse de l'onglet avec ces filtres, sans paramètre pour une valeur "tout". */
export function opportunityListSearch(search: string, state: OpportunityListState): string {
  const params = new URLSearchParams(search);
  const set = (key: string, value: string | null) =>
    value ? params.set(key, value) : params.delete(key);
  set(PARAMS.kind, state.filters.kind === ALL ? null : state.filters.kind);
  set(PARAMS.country, state.filters.country === ALL ? null : state.filters.country);
  set(PARAMS.domain, state.filters.domain === ALL ? null : state.filters.domain);
  set(PARAMS.closed, state.includeClosed ? "1" : null);
  const next = params.toString();
  return next ? `?${next}` : "";
}

/** Retire les filtres des Opportunités, pour un autre onglet du fil. */
export function withoutOpportunityParams(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of Object.values(PARAMS)) params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : "";
}
