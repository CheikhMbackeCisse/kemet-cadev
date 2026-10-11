import { COUNTRIES } from "@kemet/shared";
import { Flag } from "./Flag.js";
import { Select } from "./Select.js";

export interface CountrySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}

const OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: (
    <span className="flex items-center gap-2">
      <Flag countryCode={country.code} />
      {country.name}
    </span>
  ),
}));

export function CountrySelect({ value, onValueChange, placeholder, ...aria }: CountrySelectProps) {
  return <Select value={value} onValueChange={onValueChange} options={OPTIONS} placeholder={placeholder} {...aria} />;
}
