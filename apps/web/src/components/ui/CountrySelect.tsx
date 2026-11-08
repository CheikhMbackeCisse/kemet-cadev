import { AFRICAN_COUNTRY_CODES, COUNTRIES } from "@kemet/shared";
import { Flag } from "./Flag.js";
import { Select } from "./Select.js";

export interface CountrySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

const AFRICAN = new Set<string>(AFRICAN_COUNTRY_CODES);

function option(country: (typeof COUNTRIES)[number]) {
  return {
    value: country.code,
    label: (
      <span className="flex items-center gap-2">
        <Flag countryCode={country.code} />
        {country.name}
      </span>
    ),
  };
}

const AFRICAN_OPTIONS = COUNTRIES.filter((country) => AFRICAN.has(country.code)).map(option);

// Les 54 pays d'Afrique seulement, comme à l'inscription. Un pays d'ailleurs
// choisi avant cette règle reste affiché tant qu'il n'est pas changé.
function optionsFor(value: string) {
  if (value === "" || AFRICAN.has(value)) return AFRICAN_OPTIONS;
  const current = COUNTRIES.find((country) => country.code === value);
  return current ? [option(current), ...AFRICAN_OPTIONS] : AFRICAN_OPTIONS;
}

export function CountrySelect({
  value,
  onValueChange,
  placeholder,
  disabled,
  ...aria
}: CountrySelectProps) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      options={optionsFor(value)}
      placeholder={placeholder}
      disabled={disabled}
      {...aria}
    />
  );
}
