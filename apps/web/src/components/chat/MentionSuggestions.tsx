import type { MentionSuggestion } from "../../lib/chat/useMentionAutocomplete.js";
import { cn } from "../../lib/cn.js";

export const MENTION_LISTBOX_ID = "mention-suggestions";

export function mentionOptionId(index: number) {
  return `${MENTION_LISTBOX_ID}-${index}`;
}

interface MentionSuggestionsProps {
  suggestions: MentionSuggestion[];
  activeIndex: number;
  label: string;
  onSelect: (suggestion: MentionSuggestion) => void;
}

export function MentionSuggestions({
  suggestions,
  activeIndex,
  label,
  onSelect,
}: MentionSuggestionsProps) {
  return (
    <ul
      id={MENTION_LISTBOX_ID}
      role="listbox"
      aria-label={label}
      className="absolute inset-x-0 bottom-full mb-2 flex flex-col overflow-hidden rounded-card border border-border bg-surface p-1 shadow-floating"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.id}
          id={mentionOptionId(index)}
          role="option"
          aria-selected={index === activeIndex}
          // Garde le focus dans le composeur, et le clavier mobile ouvert.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onSelect(suggestion)}
          className={cn(
            "flex h-control max-md:h-control-mobile cursor-pointer items-center gap-2 rounded-control px-2 text-sm",
            index === activeIndex && "bg-accent-soft",
          )}
        >
          <span className="truncate font-medium text-text">{suggestion.label}</span>
          <span className="truncate text-xs text-subtle">{suggestion.detail}</span>
        </li>
      ))}
    </ul>
  );
}
