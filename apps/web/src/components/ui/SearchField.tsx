import { Search, X } from "lucide-react";
import { useId, useRef, type RefObject } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { Input } from "./Input.js";

export interface SearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Pour donner le focus au champ dans le geste qui l'ouvre (clavier du téléphone). */
  inputRef?: RefObject<HTMLInputElement>;
  /** Échap sur un champ déjà vide : referme la recherche qui le porte. */
  onEscapeEmpty?: () => void;
}

/**
 * Champ de recherche : loupe à gauche, croix pour vider à droite dès qu'il y
 * a du texte. Échap vide aussi le champ.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  className,
  inputRef: externalRef,
  onEscapeEmpty,
}: SearchFieldProps) {
  const id = useId();
  const ownRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? ownRef;
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        id={id}
        type="text"
        role="searchbox"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          if (value) {
            event.preventDefault();
            onChange("");
          } else if (onEscapeEmpty) {
            event.preventDefault();
            onEscapeEmpty();
          }
        }}
        className="px-9"
      />
      {value && (
        <button
          type="button"
          aria-label={fr.common.clearSearch}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          // 32 px à l'œil, 44 px au doigt.
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted after:absolute after:-inset-1.5 hover:bg-surface-2 hover:text-text"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
