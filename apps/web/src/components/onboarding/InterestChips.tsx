import { Check } from "lucide-react";
import { INTERESTS, type Interest } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

export interface InterestChipsProps {
  value: Interest[];
  onChange: (value: Interest[]) => void;
}

export function InterestChips({ value, onChange }: InterestChipsProps) {
  function toggle(interest: Interest) {
    onChange(value.includes(interest) ? value.filter((item) => item !== interest) : [...value, interest]);
  }

  return (
    <fieldset>
      <legend className="sr-only">{fr.onboarding.interestsListLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => (
          <label key={interest} className="relative cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(interest)}
              onChange={() => toggle(interest)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex min-h-control-mobile items-center gap-1.5 rounded-full bg-surface-2 px-4 text-base text-text md:min-h-control",
                "hover:bg-border",
                "peer-checked:bg-primary peer-checked:text-white",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
              )}
            >
              {value.includes(interest) && <Check aria-hidden="true" className="h-4 w-4" />}
              {fr.onboarding.interests[interest]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
