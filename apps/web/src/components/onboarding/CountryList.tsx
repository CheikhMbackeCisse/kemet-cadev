import { useId, useMemo, useState } from "react";
import { AFRICAN_COUNTRY_CODES, COUNTRIES } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { Flag } from "../ui/Flag.js";
import { Input } from "../ui/Input.js";
import { RadioList } from "./RadioList.js";
import type { ChoiceTone } from "./choiceTone.js";
import { fr } from "../../i18n/fr.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const AFRICAN = new Set(AFRICAN_COUNTRY_CODES);
const AFRICAN_COUNTRIES = COUNTRIES.filter((country) => AFRICAN.has(country.code));

export interface CountryListProps {
  value: string;
  onChange: (code: string) => void;
  tone?: ChoiceTone;
}

/**
 * Les 54 pays d'Afrique, avec une recherche sans accent ni casse. Kemet
 * réunit les développeurs africains : aucun autre pays n'est proposé.
 */
export function CountryList({ value, onChange, tone = "page" }: CountryListProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const needle = normalize(query);

  const options = useMemo(() => {
    // Un pays déjà choisi hors d'Afrique (profil plus ancien) reste affiché et coché.
    const current = AFRICAN.has(value)
      ? undefined
      : COUNTRIES.find((country) => country.code === value);
    return (current ? [current, ...AFRICAN_COUNTRIES] : AFRICAN_COUNTRIES)
      .filter((country) => normalize(country.name).includes(needle))
      .map((country) => ({
        value: country.code,
        label: (
          <>
            {/* Le nom suit : le drapeau répété ferait lire le pays deux fois. */}
            <span aria-hidden="true" className="inline-flex">
              <Flag countryCode={country.code} decorative />
            </span>
            {country.name}
          </>
        ),
      }));
  }, [needle, value]);

  return (
    <>
      <label
        htmlFor={searchId}
        className={cn("text-sm", tone === "glass" ? "text-auth-text" : "text-text-2")}
      >
        {fr.onboarding.countrySearchLabel}
      </label>
      <Input
        id={searchId}
        type="search"
        autoComplete="off"
        placeholder={fr.onboarding.countrySearchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="-mx-1 max-h-[40vh] overflow-y-auto p-1">
        {options.length === 0 ? (
          <p className={cn("py-4 text-sm", tone === "glass" ? "text-auth-text" : "text-text-2")}>
            {fr.onboarding.countryNoResult(query.trim())}
          </p>
        ) : (
          <RadioList
            name="country"
            label={fr.onboarding.countryListLabel}
            options={options}
            value={value}
            onChange={onChange}
            tone={tone}
          />
        )}
      </div>
    </>
  );
}
