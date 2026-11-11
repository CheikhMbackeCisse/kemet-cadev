import { X } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { KoccSymbol } from "./KoccSymbol.js";

/** Étiquette au-dessus du champ tant que le brouillon commence par @kocc ; la croix retire la mention. */
export function KoccQuestionTag({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-accent-soft pl-2 pr-0.5 text-xs font-medium text-link">
      <KoccSymbol className="size-4" />
      {fr.assistant.questionTag}
      <button
        type="button"
        onClick={onRemove}
        aria-label={fr.assistant.removeQuestionTag}
        title={fr.assistant.removeQuestionTag}
        className="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
