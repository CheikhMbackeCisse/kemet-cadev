import { useId, useMemo, useState } from "react";
import { COUNTRIES } from "@kemet/shared";
import { Flag } from "../ui/Flag.js";
import { Input } from "../ui/Input.js";
import { RadioList } from "./RadioList.js";
import { fr } from "../../i18n/fr.js";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export interface CountryListProps {
  value: string;
  onChange: (code: string) => void;
}

/** Liste des pays filtrée par une recherche, sans accent ni casse. */
export function CountryList({ value, onChange }: CountryListProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const needle = normalize(query);
    return COUNTRIES.filter((country) => normalize(country.name).includes(needle)).map((country) => ({
      value: country.code,
      label: (
        <>
          {/* Le nom suit : le drapeau répété ferait lire le pays deux fois. */}
          <span aria-hidden="true" className="inline-flex">
            <Flag countryCode={country.code} />
          </span>
          {country.name}
        </>
      ),
    }));
  }, [query]);

  return (
    <>
      <label htmlFor={searchId} className="text-sm text-text-2">
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
      {options.length === 0 ? (
        <p className="py-4 text-sm text-text-2">{fr.onboarding.countryNoResult(query.trim())}</p>
      ) : (
        <RadioList
          name="country"
          label={fr.onboarding.countryListLabel}
          options={options}
          value={value}
          onChange={onChange}
          className="md:max-h-[50vh] md:overflow-y-auto md:p-1"
        />
      )}
    </>
  );
}
