// Mots de liaison ignorés : "Carrière & Freelance Tech" donne CF, pas C&.
const MONOGRAM_SKIP = new Set(["de", "du", "des", "la", "le", "les", "et", "d", "l"]);

/** Initiales d'un nom d'espace, faute d'image. */
export function monogramOf(name: string): string {
  const words = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !MONOGRAM_SKIP.has(word.toLowerCase()));
  const initials = words.slice(0, 2).map((word) => word[0]!);
  return (initials.join("") || "?").toUpperCase();
}
