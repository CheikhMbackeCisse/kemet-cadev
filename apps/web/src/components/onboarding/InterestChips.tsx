import { INTERESTS, type Interest } from "@kemet/shared";
import { ChoiceChips } from "./ChoiceChips.js";
import { fr } from "../../i18n/fr.js";

export interface InterestChipsProps {
  value: Interest[];
  onChange: (value: Interest[]) => void;
}

export function InterestChips({ value, onChange }: InterestChipsProps) {
  return (
    <ChoiceChips
      label={fr.onboarding.interestsListLabel}
      options={INTERESTS}
      labels={fr.onboarding.interests}
      value={value}
      onChange={onChange}
    />
  );
}
