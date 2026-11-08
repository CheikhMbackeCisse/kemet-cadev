import { ChevronDown, Globe } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { AFRICAN_COUNTRY_CODES, COUNTRIES, type Country } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { Flag } from "../ui/Flag.js";
import { Input } from "../ui/Input.js";
import { RadioList } from "./RadioList.js";
import { choiceFrameClass, choiceIconClass, type ChoiceTone } from "./choiceTone.js";
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
const OTHER_COUNTRIES = COUNTRIES.filter((country) => !AFRICAN.has(country.code));

export interface CountryListProps {
  value: string;
  onChange: (code: string) => void;
  tone?: ChoiceTone;
}

/**
 * Les 54 pays d'Afrique d'abord, puis une ligne "Autre pays" qui ouvre la
 * liste complète. Une recherche, sans accent ni casse, parcourt tous les pays.
 */
export function CountryList({ value, onChange, tone = "page" }: CountryListProps) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(() => value !== "" && !AFRICAN.has(value));
  const needle = normalize(query);
  const searching = needle !== "";

  const options = useMemo(() => {
    const pool: readonly Country[] =
      searching || showAll ? [...AFRICAN_COUNTRIES, ...OTHER_COUNTRIES] : AFRICAN_COUNTRIES;
    return pool
      .filter((country) => normalize(country.name).includes(needle))
      .map((country) => ({
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
  }, [needle, searching, showAll]);

  return (
    <>
      <label
        htmlFor={searchId}
        className={cn("text-sm", tone === "glass" ? "text-auth-text" : "text-text-2")}
      >
        {fr.onboarding.countrySearchLabel}
      </label>
      <Input
        ref={searchRef}
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
        {!searching && !showAll && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => {
              // Le bouton disparaît : le focus reprend dans la recherche.
              setShowAll(true);
              searchRef.current?.focus();
            }}
            className={cn(
              "mt-2 flex min-h-control-mobile w-full items-center gap-3 px-3 text-left text-base md:min-h-control",
              choiceFrameClass(tone),
            )}
          >
            <Globe aria-hidden="true" className={cn("size-5 shrink-0", choiceIconClass(tone))} />
            {fr.onboarding.countryOther}
            <ChevronDown
              aria-hidden="true"
              className={cn("ml-auto size-4 shrink-0", choiceIconClass(tone))}
            />
          </button>
        )}
      </div>
    </>
  );
}
