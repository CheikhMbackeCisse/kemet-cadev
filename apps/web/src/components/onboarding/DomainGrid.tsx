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

/**
 * Les seize domaines en cases à cocher natives : deux colonnes sur téléphone,
 * quatre sur bureau. Sur téléphone, une case tient sur une ligne basse (icône
 * à gauche, remplacée par une coche une fois choisie) pour que "Continuer"
 * reste visible sans défiler en 390 x 844.
 */
export function DomainGrid({ value, onChange, tone = "page" }: DomainGridProps) {
  function toggle(interest: Interest) {
    onChange(
      value.includes(interest) ? value.filter((item) => item !== interest) : [...value, interest],
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">{fr.onboarding.interestsListLabel}</legend>
      <div className="grid auto-rows-fr grid-cols-2 gap-2 md:grid-cols-4">
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
                  "flex h-full min-h-11 items-center gap-2 px-2.5 py-1.5 text-left text-[13px] leading-tight",
                  "md:min-h-16 md:flex-col md:justify-center md:gap-1.5 md:px-2 md:py-2 md:text-center md:text-sm",
                  choiceFrameClass(tone),
                )}
              >
                {checked ? (
                  <Check
                    aria-hidden="true"
                    className={cn("size-4 shrink-0 md:hidden", choiceCheckClass(tone))}
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0 md:size-5",
                    checked && "max-md:hidden",
                    choiceIconClass(tone),
                  )}
                />
                {fr.onboarding.interests[interest]}
              </span>
              {checked && (
                <Check
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1.5 top-1.5 hidden size-3.5 md:block",
                    choiceCheckClass(tone),
                  )}
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
