import { useId } from "react";
import { Checkbox } from "../ui/Checkbox.js";

export interface BeginnerCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  hint: string;
}

/** Case "Débutant" des formulaires de post et de skill, avec sa phrase d'explication. */
export function BeginnerCheckbox({ checked, onCheckedChange, label, hint }: BeginnerCheckboxProps) {
  const hintId = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <label className="flex items-start gap-3 text-sm text-text">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={hintId}
          className="mt-0.5 shrink-0"
        />
        {label}
      </label>
      <p id={hintId} className="pl-8 text-xs text-subtle">
        {hint}
      </p>
    </div>
  );
}
