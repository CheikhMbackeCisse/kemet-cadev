import { useId, useRef, type ReactNode } from "react";
import { Textarea, type TextareaProps } from "../ui/Textarea.js";
import { CodeButton } from "./CodeButton.js";
import { usePasteAsCode } from "./usePasteAsCode.js";

export interface CodeTextareaProps extends Omit<TextareaProps, "value" | "onChange"> {
  label?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  /** Affichée sous le champ (FormField). */
  error?: string | null;
}

/**
 * Champ de texte long d'un formulaire, avec le bouton Code au-dessus. Le
 * bouton reste hors du `<label>` : placé dedans, il en deviendrait la cible.
 */
export function CodeTextarea({
  label,
  value,
  onValueChange,
  id,
  disabled,
  error,
  ...props
}: CodeTextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { handlePaste, notice } = usePasteAsCode(textareaRef, onValueChange, "-mt-1");

  return (
    <div className="flex flex-col gap-1 text-sm text-text-2">
      <div className={label ? "flex items-end justify-between gap-2" : "flex justify-end"}>
        {label && <label htmlFor={textareaId}>{label}</label>}
        <CodeButton textareaRef={textareaRef} onChange={onValueChange} disabled={disabled} />
      </div>
      <Textarea
        ref={textareaRef}
        id={textareaId}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onPaste={handlePaste}
        disabled={disabled}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : props["aria-describedby"]}
      />
      {error && (
        <p id={`${textareaId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice}
    </div>
  );
}
