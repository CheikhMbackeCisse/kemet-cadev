import type { RefObject } from "react";
import { fr } from "../../i18n/fr.js";
import { addKoccMention } from "../../lib/assistant/koccDraft.js";
import { cn } from "../../lib/cn.js";
import { KoccSymbol } from "./KoccSymbol.js";

export interface KoccButtonProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Prépare une question à Kocc : "@kocc " en tête du champ, le curseur
 * juste après. Rien ne part tant que la personne n'envoie pas elle-même.
 */
export function KoccButton({ textareaRef, onChange, disabled, className }: KoccButtonProps) {
  function handleClick() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = addKoccMention(textarea.value);
    onChange(edit.value);
    // La valeur passe par l'état du parent : le curseur est placé après son rendu.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(edit.caret, edit.caret);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={fr.assistant.askButtonLabel}
      title={fr.assistant.askButtonLabel}
      className={cn(
        "inline-flex h-control shrink-0 items-center justify-center gap-1.5 rounded-control px-2 text-sm font-medium text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text",
        "max-md:h-control-mobile",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <KoccSymbol className="size-5" />
      <span aria-hidden="true" className="max-sm:hidden">
        {fr.assistant.askButton}
      </span>
    </button>
  );
}
