import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import {
  choiceCheckClass,
  choiceFrameClass,
  choiceIconClass,
  type ChoiceTone,
} from "./choiceTone.js";

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  icon?: LucideIcon;
}

interface ChoiceRowProps {
  type: "radio" | "checkbox";
  name?: string;
  option: ChoiceOption;
  checked: boolean;
  onChange: () => void;
  tone: ChoiceTone;
}

/** Une ligne de choix : icône à gauche, coche à droite quand elle est retenue. */
function ChoiceRow({ type, name, option, checked, onChange, tone }: ChoiceRowProps) {
  const Icon = option.icon;
  return (
    <label className="relative block cursor-pointer">
      <input
        type={type}
        name={name}
        value={option.value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex min-h-control-mobile items-center gap-3 px-3 text-base md:min-h-control",
          choiceFrameClass(tone),
        )}
      >
        {Icon && (
          <Icon aria-hidden="true" className={cn("size-5 shrink-0", choiceIconClass(tone))} />
        )}
        {option.label}
        {/* La coche dit le choix retenu sans dépendre de la seule couleur. */}
        {checked && (
          <Check
            aria-hidden="true"
            className={cn("ml-auto size-4 shrink-0", choiceCheckClass(tone))}
          />
        )}
      </span>
    </label>
  );
}

export interface RadioListProps {
  name: string;
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  tone?: ChoiceTone;
  className?: string;
}

/** Une liste de choix exclusifs, en boutons radio natifs : flèches du clavier comprises. */
export function RadioList({
  name,
  label,
  options,
  value,
  onChange,
  tone = "page",
  className,
}: RadioListProps) {
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <ChoiceRow
          key={option.value}
          type="radio"
          name={name}
          option={option}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          tone={tone}
        />
      ))}
    </fieldset>
  );
}

export interface CheckListProps<T extends string> {
  label: string;
  options: (ChoiceOption & { value: T })[];
  value: T[];
  onChange: (value: T[]) => void;
  tone?: ChoiceTone;
}

/** Choix multiples, une ligne chacun, sur des cases à cocher natives. */
export function CheckList<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "page",
}: CheckListProps<T>) {
  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <ChoiceRow
          key={option.value}
          type="checkbox"
          option={option}
          checked={value.includes(option.value)}
          onChange={() => toggle(option.value)}
          tone={tone}
        />
      ))}
    </fieldset>
  );
}
