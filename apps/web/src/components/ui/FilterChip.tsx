import { Check, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface FilterChipProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  label: string;
  icon?: LucideIcon;
}

/** Filtre qui s'active et se désactive d'un appui, lu comme un bouton bascule. */
export function FilterChip({
  pressed,
  onPressedChange,
  label,
  icon: Icon,
}: FilterChipProps) {
  // Activé : coche à la place de l'icône, teinte d'accent douce plutôt qu'un
  // bleu plein qui se confondrait avec le bouton principal.
  const ShownIcon = pressed ? Check : Icon;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-control items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-150 max-md:h-control-mobile",
        pressed
          ? "bg-accent-soft-2 text-[var(--level-badge-text)]"
          : "bg-surface-2 text-text-2 hover:text-text",
      )}
    >
      {ShownIcon && <ShownIcon className="size-4" aria-hidden="true" />}
      {label}
    </button>
  );
}
