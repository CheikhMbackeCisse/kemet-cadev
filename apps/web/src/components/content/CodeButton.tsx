import { Braces } from "lucide-react";
import { useRef, type RefObject } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import {
  CODE_LANGUAGES,
  INLINE_CODE,
  insertCode,
  type TextEdit,
} from "../../lib/content/insertCode.js";
import { Menu } from "../ui/Menu.js";

// "Code en ligne" puis "Texte" d'abord : ce ne sont pas des langages, ils se
// perdraient au bas d'une liste qui défile sur mobile.
const MENU_ITEMS = [
  { value: INLINE_CODE, label: fr.content.inlineCode },
  ...CODE_LANGUAGES.map((language) => ({
    value: language.value,
    label: language.label ?? fr.content.plainTextLanguage,
  })),
];

export interface CodeButtonProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Menu des langages qui insère un bloc de code dans le champ relié. */
export function CodeButton({ textareaRef, onChange, disabled, className }: CodeButtonProps) {
  const pendingSelection = useRef<TextEdit | null>(null);

  function handleSelect(language: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const edit = insertCode(
      {
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
      },
      language,
    );
    pendingSelection.current = edit;
    onChange(edit.value);
  }

  function restoreFocus(event: Event) {
    const textarea = textareaRef.current;
    const edit = pendingSelection.current;
    if (!textarea || !edit) return;
    event.preventDefault();
    pendingSelection.current = null;
    // La valeur passe par l'état du parent : on attend son rendu avant de
    // replacer le curseur, sinon React l'écrase en réécrivant le champ.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  return (
    <Menu
      align="start"
      items={MENU_ITEMS}
      onSelect={handleSelect}
      onCloseAutoFocus={restoreFocus}
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-control items-center justify-center gap-2 rounded-control px-2 text-sm font-medium text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text",
            "max-md:h-control-mobile",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <Braces className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">{fr.content.codeButton}</span>
        </button>
      }
    />
  );
}
