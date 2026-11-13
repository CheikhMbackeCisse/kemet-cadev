/** Motif ILIKE "contient" où `%`, `_` et `\` tapés par la personne restent du texte. */
export function containsPattern(query: string): string {
  return `%${escapeLike(query)}%`;
}

/** Motif ILIKE "commence par", même échappement. */
export function prefixPattern(query: string): string {
  return `${escapeLike(query)}%`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
