import { AFRICAN_COUNTRY_CODES, COUNTRIES, INTERESTS, OPPORTUNITY_KINDS } from "@kemet/shared";
import { ALL, type OpportunityFilterValues } from "../../lib/opportunities/listState.js";
import { fr } from "../../i18n/fr.js";
import { Select } from "../ui/Select.js";

const AFRICAN = new Set(AFRICAN_COUNTRY_CODES);

// Pastilles plus basses qu’un champ de formulaire : trois tiennent sur une ligne.
const FILTER_CLASS =
  "h-9 w-auto shrink-0 gap-1.5 whitespace-nowrap rounded-full px-3 text-sm max-md:h-9 max-md:text-sm";

const allLabel = (label: string) => `${label} : ${fr.opportunities.filterAll}`;

const KIND_OPTIONS = [
  { value: ALL, label: allLabel(fr.opportunities.filterType) },
  ...OPPORTUNITY_KINDS.map((kind) => ({
    value: kind,
    label: fr.opportunities.kinds[kind],
  })),
];

const COUNTRY_OPTIONS = [
  { value: ALL, label: allLabel(fr.opportunities.filterCountry) },
  ...COUNTRIES.filter((country) => AFRICAN.has(country.code)).map((country) => ({
    value: country.code,
    label: country.name,
  })),
];

const DOMAIN_OPTIONS = [
  { value: ALL, label: allLabel(fr.opportunities.filterDomain) },
  ...INTERESTS.filter((interest) => interest !== "other").map((interest) => ({
    value: interest,
    label: fr.onboarding.interests[interest],
  })),
];

/** Type, Pays, Domaine sur une seule ligne, qui défile sur un téléphone. */
export function OpportunityFilters({
  value,
  onChange,
}: {
  value: OpportunityFilterValues;
  onChange: (value: OpportunityFilterValues) => void;
}) {
  return (
    <div
      role="group"
      aria-label={fr.opportunities.filtersLabel}
      data-no-tab-swipe
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0"
    >
      <Select
        aria-label={fr.opportunities.filterType}
        value={value.kind}
        onValueChange={(kind) =>
          onChange({ ...value, kind: kind as OpportunityFilterValues["kind"] })
        }
        options={KIND_OPTIONS}
        className={FILTER_CLASS}
      />
      <Select
        aria-label={fr.opportunities.filterCountry}
        value={value.country}
        onValueChange={(country) => onChange({ ...value, country })}
        options={COUNTRY_OPTIONS}
        className={FILTER_CLASS}
      />
      <Select
        aria-label={fr.opportunities.filterDomain}
        value={value.domain}
        onValueChange={(domain) => onChange({ ...value, domain })}
        options={DOMAIN_OPTIONS}
        className={FILTER_CLASS}
      />
    </div>
  );
}
