import { Checkbox } from "../ui/Checkbox.js";

export interface BeginnerCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

/** Case "Débutant" des formulaires de post et de skill. */
export function BeginnerCheckbox({ checked, onCheckedChange, label }: BeginnerCheckboxProps) {
  return (
    <label className="flex items-start gap-3 text-sm text-text">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
      {label}
    </label>
  );
}
