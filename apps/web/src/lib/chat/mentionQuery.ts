export interface MentionQuery {
  kind: "profile" | "skill";
  query: string;
  /** Position du premier caractère à remplacer par la suggestion. */
  start: number;
}

const PROFILE_TRIGGER = /(^|\s)@([\w-]*)$/;
const SKILL_TRIGGER = /(^|\s)@(?:kocc|kemet)\s+avec\s+([\w-]*)$/i;

/** Ce qui est en train d'être tapé juste avant le curseur, s'il appelle une suggestion. */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const skill = SKILL_TRIGGER.exec(before);
  if (skill) return { kind: "skill", query: skill[2]!, start: caret - skill[2]!.length };
  const profile = PROFILE_TRIGGER.exec(before);
  if (profile) return { kind: "profile", query: profile[2]!, start: caret - profile[2]!.length };
  return null;
}

/** Remplace la saisie en cours par la valeur retenue, suivie d'une espace. */
export function applySuggestion(
  text: string,
  caret: number,
  query: MentionQuery,
  value: string,
): { text: string; caret: number } {
  const inserted = `${value} `;
  return {
    text: text.slice(0, query.start) + inserted + text.slice(caret),
    caret: query.start + inserted.length,
  };
}
