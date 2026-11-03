import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ClipboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { fr } from "../../i18n/fr.js";
import { insertCode } from "../../lib/content/insertCode.js";
import {
  guessLanguage,
  isInsideCodeFence,
  languageFromEditor,
  looksLikeCode,
} from "../../lib/content/pasteCode.js";

const NOTICE_DURATION_MS = 10000;

function placeCaret(textarea: HTMLTextAreaElement, position: number) {
  // Attend le rendu de la nouvelle valeur, qui remettrait sinon le curseur à la fin.
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(position, position);
  });
}

interface PasteAsCodeNoticeProps {
  onUndo: (() => void) | null;
  onDismiss: () => void;
  onFocusChange: (focused: boolean) => void;
  emptyClassName?: string;
}

// La zone live reste en place, vide, pour que l'arrivée du texte soit annoncée.
function PasteAsCodeNotice({
  onUndo,
  onDismiss,
  onFocusChange,
  emptyClassName,
}: PasteAsCodeNoticeProps) {
  return (
    <div
      role="status"
      onFocus={() => onFocusChange(true)}
      onBlur={() => onFocusChange(false)}
      className={onUndo ? "flex items-center gap-2 text-sm text-text-2" : emptyClassName}
    >
      {onUndo && (
        <>
          <span>{fr.content.pastedAsCode}</span>
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex h-control-compact items-center rounded-control px-1 font-medium text-link hover:underline max-md:h-control-mobile"
          >
            {fr.content.undoPasteAsCode}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={fr.content.dismissPasteNotice}
            className="ml-auto inline-flex size-control-compact items-center justify-center rounded-control text-muted hover:text-text max-md:size-control-mobile"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

export interface PasteAsCode {
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Ligne "Collé comme code" avec "Remettre en texte", à poser près du champ. */
  notice: ReactNode;
}

/**
 * Gestionnaire de collage qui place dans un bloc de code un texte d'au moins
 * trois lignes qui ressemble à du code, avec une ligne d'état pour revenir au texte.
 */
export function usePasteAsCode(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  onChange: (value: string) => void,
  /** Annule l'écart du conteneur parent tant que la ligne est vide. */
  emptyClassName?: string,
): PasteAsCode {
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!undo || focused) return;
    const timer = window.setTimeout(() => setUndo(null), NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [undo, focused]);

  // Une saisie après le collage rend "Remettre en texte" sans effet : la
  // ligne disparaît plutôt que de proposer une action qui ne fera rien.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!undo || !textarea) return;
    const clear = () => setUndo(null);
    textarea.addEventListener("input", clear);
    return () => textarea.removeEventListener("input", clear);
  }, [undo, textareaRef]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current;
      const pasted = event.clipboardData.getData("text/plain");
      if (!textarea || !looksLikeCode(pasted)) return;
      const { value, selectionStart, selectionEnd } = textarea;
      if (isInsideCodeFence(value, selectionStart)) return;

      event.preventDefault();
      const language =
        languageFromEditor(event.clipboardData.getData("vscode-editor-data")) ??
        guessLanguage(pasted);
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);
      const plain = `${before}${pasted}${after}`;
      const wrapped = insertCode(
        {
          value: plain,
          selectionStart: before.length,
          selectionEnd: before.length + pasted.length,
        },
        language,
      );
      const closingEnd = wrapped.value.length - after.length;
      onChange(wrapped.value);
      placeCaret(textarea, closingEnd);

      setUndo(() => () => {
        setUndo(null);
        setFocused(false);
        // N'écrase pas une autre modification faite depuis le collage.
        if (textarea.value !== wrapped.value) return;
        onChange(plain);
        placeCaret(textarea, before.length + pasted.length);
      });
    },
    [textareaRef, onChange],
  );

  const notice = (
    <PasteAsCodeNotice
      onUndo={undo}
      onDismiss={() => {
        setUndo(null);
        setFocused(false);
        textareaRef.current?.focus();
      }}
      onFocusChange={setFocused}
      emptyClassName={emptyClassName}
    />
  );

  return { handlePaste, notice };
}
