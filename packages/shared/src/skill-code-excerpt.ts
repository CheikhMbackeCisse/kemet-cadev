/** Extrait de code d'un skill montré en couverture : texte brut, borné. */
export interface SkillCodeExcerpt {
  /** Langue annoncée par le bloc (```dart), en minuscules ; null sans bloc ou sans langue. */
  language: string | null;
  lines: string[];
}

export const SKILL_EXCERPT_MAX_LINES = 6;
export const SKILL_EXCERPT_MAX_LINE_LENGTH = 72;

// Caractères de contrôle retirés : l'extrait est affiché tel quel, en texte.
// Les marques de sens d'écriture et les espaces de largeur nulle en font
// partie : elles feraient lire une ligne dans un autre ordre que le code.
const CONTROL_CHARACTERS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}-${String.fromCharCode(31)}${String.fromCharCode(127)}\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069]`,
  "g",
);

function clean(line: string): string {
  return line
    .replace(/\t/g, "  ")
    .replace(CONTROL_CHARACTERS, "")
    .trimEnd()
    .slice(0, SKILL_EXCERPT_MAX_LINE_LENGTH);
}

/**
 * Six premières lignes du premier bloc de code du contenu ; sans bloc, ses
 * six premières lignes non vides.
 */
export function skillCodeExcerpt(content: string): SkillCodeExcerpt {
  const lines = content.split(/\r?\n/);
  const fenceIndex = lines.findIndex((line) => /^\s*(```|~~~)/.test(line));
  if (fenceIndex !== -1) {
    const fence = lines[fenceIndex]!.trim();
    const marker = fence.slice(0, 3);
    const language = fence.slice(3).trim().split(/\s+/)[0]?.toLowerCase() || null;
    const body: string[] = [];
    for (const line of lines.slice(fenceIndex + 1)) {
      if (line.trim().startsWith(marker) || body.length === SKILL_EXCERPT_MAX_LINES) break;
      body.push(clean(line));
    }
    while (body.length > 0 && body[body.length - 1] === "") body.pop();
    if (body.length > 0) return { language: language?.slice(0, 20) ?? null, lines: body };
  }
  return {
    language: null,
    lines: lines
      .map(clean)
      .filter((line) => line.trim() !== "")
      .slice(0, SKILL_EXCERPT_MAX_LINES),
  };
}
