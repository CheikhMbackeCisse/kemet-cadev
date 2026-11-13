import type { RefObject } from "react";
import { fr } from "../../i18n/fr.js";
import { addKoccMention } from "../../lib/assistant/koccDraft.js";
import { cn } from "../../lib/cn.js";
import { COMPOSER_ICON_CLASS, COMPOSER_ROUND_CLASS } from "../composer/ComposerBar.js";
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
      className={cn(COMPOSER_ROUND_CLASS, "hover:bg-surface-2 disabled:opacity-50", className)}
    >
      <KoccSymbol className={COMPOSER_ICON_CLASS} />
    </button>
  );
}
