import { Check } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface ChoiceChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T[];
  onChange: (value: T[]) => void;
}

/** Choix multiples en pastilles, sur des cases à cocher natives. */
export function ChoiceChips<T extends string>({ label, options, labels, value, onChange }: ChoiceChipsProps<T>) {
  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="relative cursor-pointer">
            <input
              type="checkbox"
              checked={value.includes(option)}
              onChange={() => toggle(option)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex min-h-control-mobile items-center gap-1.5 rounded-full bg-surface-2 px-4 text-base text-text md:min-h-control",
                "md:hover:bg-border",
                "peer-checked:bg-primary peer-checked:text-white",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
              )}
            >
              {value.includes(option) && <Check aria-hidden="true" className="h-4 w-4" />}
              {labels[option]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
