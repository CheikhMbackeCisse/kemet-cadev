import { useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { ASSISTANT_MENTION_HANDLE, type SkillSummary, type SpaceMember } from "@kemet/shared";
import { listSkills } from "./api.js";
import { applySuggestion, findMentionQuery } from "./mentionQuery.js";

const MAX_SUGGESTIONS = 6;

export interface MentionSuggestion {
  id: string;
  /** Texte inséré dans le message. */
  value: string;
  label: string;
  detail: string;
}

interface Options {
  draft: string;
  setDraft: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  members: SpaceMember[];
  ownProfileId: string | null;
  assistantLabel: string;
}

function matches(query: string, ...fields: string[]) {
  const needle = query.toLowerCase();
  return fields.some((field) => field.toLowerCase().includes(needle));
}

export function useMentionAutocomplete({
  draft,
  setDraft,
  textareaRef,
  members,
  ownProfileId,
  assistantLabel,
}: Options) {
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);

  const query = useMemo(() => findMentionQuery(draft, caret), [draft, caret]);
  const open = query !== null && dismissedAt !== query.start;

  // Chargés seulement quand on cite un skill pour la première fois.
  useEffect(() => {
    if (query?.kind !== "skill" || skills !== null) return;
    listSkills()
      .then((page) => setSkills(page.items))
      .catch(() => setSkills([]));
  }, [query?.kind, skills]);

  const suggestions = useMemo<MentionSuggestion[]>(() => {
    if (!query || !open) return [];
    if (query.kind === "skill") {
      // Publics seulement : un skill d'un autre espace ou privé, proposé ici,
      // afficherait son nom devant des membres qui n'y ont pas accès.
      return (skills ?? [])
        .filter((skill) => skill.visibility === "public")
        .filter((skill) => matches(query.query, skill.slug, skill.name))
        .slice(0, MAX_SUGGESTIONS)
        .map((skill) => ({
          id: skill.id,
          value: skill.slug,
          label: skill.name,
          detail: skill.slug,
        }));
    }
    const assistant: MentionSuggestion[] = matches(query.query, ASSISTANT_MENTION_HANDLE)
      ? [
          {
            id: ASSISTANT_MENTION_HANDLE,
            value: ASSISTANT_MENTION_HANDLE,
            label: assistantLabel,
            detail: `@${ASSISTANT_MENTION_HANDLE}`,
          },
        ]
      : [];
    const people = members
      .filter((member) => member.profileId !== ownProfileId)
      .filter((member) => matches(query.query, member.handle, member.displayName))
      .map((member) => ({
        id: member.profileId,
        value: member.handle,
        label: member.displayName,
        detail: `@${member.handle}`,
      }));
    return [...assistant, ...people].slice(0, MAX_SUGGESTIONS);
  }, [query, open, skills, members, ownProfileId, assistantLabel]);

  useEffect(() => setActiveIndex(0), [query?.kind, query?.query]);

  function syncCaret() {
    const textarea = textareaRef.current;
    if (textarea) setCaret(textarea.selectionStart);
  }

  function select(suggestion: MentionSuggestion) {
    if (!query) return;
    const next = applySuggestion(draft, caret, query, suggestion.value);
    setDraft(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(next.caret, next.caret);
    });
  }

  /** Vrai si la touche a servi à la liste : le composeur ne doit pas l'interpréter. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (suggestions.length === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
      return true;
    }
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      event.preventDefault();
      select(suggestions[activeIndex]!);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAt(query!.start);
      return true;
    }
    return false;
  }

  return { suggestions, activeIndex, select, syncCaret, handleKeyDown };
}
