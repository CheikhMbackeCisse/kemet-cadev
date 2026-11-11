import { ASSISTANT_MENTION_HANDLE } from "@kemet/shared";

// Mention en tête du brouillon, avec l'ancien "@kemet" qui appelle toujours
// l'assistant. Un identifiant plus long ("@kocc-fan") n'en est pas une.
const LEADING_MENTION = /^\s*@(?:kocc|kemet)(?![a-z0-9-])[ \t]*/i;

export const KOCC_PREFIX = `@${ASSISTANT_MENTION_HANDLE} `;

export interface DraftEdit {
  value: string;
  caret: number;
}

/** Le brouillon commence par une question à Kocc. */
export function asksKocc(draft: string): boolean {
  return LEADING_MENTION.test(draft);
}

/** Met "@kocc " en tête du brouillon, une seule fois, le curseur juste après. */
export function addKoccMention(draft: string): DraftEdit {
  const existing = LEADING_MENTION.exec(draft);
  if (existing) return { value: draft, caret: existing[0].length };
  return { value: KOCC_PREFIX + draft.replace(/^\s+/, ""), caret: KOCC_PREFIX.length };
}

/** Retire la mention de tête : le reste du brouillon ne bouge pas. */
export function removeKoccMention(draft: string): string {
  return draft.replace(LEADING_MENTION, "");
}
