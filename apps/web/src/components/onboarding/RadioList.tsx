import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface RadioListOption {
  value: string;
  label: ReactNode;
}

export interface RadioListProps {
  name: string;
  label: string;
  options: RadioListOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Une liste de choix exclusifs, en boutons radio natifs : flèches du clavier comprises. */
export function RadioList({ name, label, options, value, onChange, className }: RadioListProps) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="relative block cursor-pointer">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex min-h-control-mobile items-center gap-3 rounded-control border border-border-strong px-3 text-base text-text md:min-h-control",
              "md:hover:bg-surface-2",
              "peer-checked:border-primary peer-checked:bg-surface-2 peer-checked:font-medium",
              "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
            )}
          >
            {option.label}
            {/* La coche dit le choix retenu sans dépendre de la seule couleur. */}
            {value === option.value && <Check aria-hidden="true" className="ml-auto size-4 shrink-0 text-primary" />}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
