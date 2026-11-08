import { Check } from "lucide-react";
import { INTERESTS, type Interest } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { INTEREST_ICONS } from "../../lib/onboarding/choiceIcons.js";
import { fr } from "../../i18n/fr.js";
import {
  choiceCheckClass,
  choiceFrameClass,
  choiceIconClass,
  type ChoiceTone,
} from "./choiceTone.js";

export interface DomainGridProps {
  value: Interest[];
  onChange: (value: Interest[]) => void;
  tone?: ChoiceTone;
}

/** Les seize domaines en cases à cocher natives : deux colonnes sur téléphone, quatre sur bureau. */
export function DomainGrid({ value, onChange, tone = "page" }: DomainGridProps) {
  function toggle(interest: Interest) {
    onChange(
      value.includes(interest) ? value.filter((item) => item !== interest) : [...value, interest],
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">{fr.onboarding.interestsListLabel}</legend>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {INTERESTS.map((interest) => {
          const Icon = INTEREST_ICONS[interest];
          const checked = value.includes(interest);
          return (
            <label key={interest} className="relative block cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(interest)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-full min-h-16 flex-col items-center justify-center gap-1.5 px-2 py-2 text-center text-sm",
                  choiceFrameClass(tone),
                )}
              >
                <Icon aria-hidden="true" className={cn("size-5", choiceIconClass(tone))} />
                {fr.onboarding.interests[interest]}
              </span>
              {checked && (
                <Check
                  aria-hidden="true"
                  className={cn("absolute right-1.5 top-1.5 size-3.5", choiceCheckClass(tone))}
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
