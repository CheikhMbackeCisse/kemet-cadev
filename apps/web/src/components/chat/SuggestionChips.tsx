import { fr } from "../../i18n/fr.js";

/** Débuts de message en pastilles : un appui remplit le composeur, rien ne part tout seul. */
export function SuggestionChips({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-subtle">{fr.chat.suggestionsLabel}</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-full bg-surface-2 px-3 py-1.5 text-left text-sm text-text-2 transition-colors duration-150 hover:bg-accent-soft max-md:min-h-control-mobile"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
