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
    <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-2", className)}>
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
              "flex min-h-control-mobile items-center gap-3 rounded-control border border-border-strong px-3 text-sm text-text md:min-h-control",
              "hover:bg-surface-2",
              "peer-checked:border-primary peer-checked:bg-surface-2 peer-checked:font-medium",
              "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}
