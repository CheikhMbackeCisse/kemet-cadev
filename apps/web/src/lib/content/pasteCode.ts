import { CODE_LANGUAGES } from "./insertCode.js";

const MIN_CODE_LINES = 3;
// Aucun champ n'accepte plus de 4000 caractères (8000 laissent de la marge) : inutile de faire tourner les
// expressions régulières sur un collage géant, dans le fil principal.
const MAX_DETECTED_LENGTH = 8000;

const CODE_LINE_PATTERNS = [
  /[;{}]\s*$/,
  /^\s*[)\]}]/,
  /^(\t| {2,})\S/,
  /=>|==|!=|:=|::|->|&&|\|\|/,
  /^\s*(import|export|from|const|let|var|function|def|class|return|if|for|while|public|private|fn|func|package|#include|SELECT|INSERT|UPDATE|CREATE)\b/,
  /^\s*<\/?[a-zA-Z][\w-]*[\s>/]/,
  /^\s*["']?[\w-]+["']?\s*:\s*\S/,
  /^\s*(\$|#!|sudo |npm |pnpm |npx |git |cd |docker )/,
];

/** Vrai pour au moins trois lignes dont la majorité ressemble à du code. */
export function looksLikeCode(text: string): boolean {
  if (text.length > MAX_DETECTED_LENGTH || text.includes("```")) return false;
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < MIN_CODE_LINES) return false;
  const codeLines = lines.filter((line) =>
    CODE_LINE_PATTERNS.some((pattern) => pattern.test(line)),
  );
  return codeLines.length * 2 > lines.length;
}

// Ordre important : un signe propre à un langage passe avant un signe partagé
// (TypeScript avant JavaScript, C++ avant C, CSS avant JavaScript à cause de
// `var(--x)`, mais après TypeScript pour qu'une classe typée reste TypeScript).
const LANGUAGE_HINTS: Array<[string, RegExp]> = [
  ["php", /<\?php|\$\w+\s*=/],
  ["html", /<!DOCTYPE|<(html|head|body|div|span|p|a|ul|li|section|main)[\s>]/i],
  ["sql", /^[ \t]*(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE)\b/im],
  ["cpp", /#include\s*<(iostream|vector|string)>|std::/],
  ["c", /#include\s*<\w+\.h>|\bprintf\s*\(/],
  ["rust", /\bfn \w+\(|\blet mut\b|println!\(/],
  ["go", /^package \w+|\bfunc \w*\(|:=/m],
  ["dart", /\bvoid main\(\)|\bWidget\b|\bfinal \w+ \w+ =|\bsetState\(/],
  ["java", /\bpublic (static |final )*(class|void|interface)\b|System\.out\./],
  ["python", /^[ \t]*(def \w+\(.*\):|class \w+(\(.*\))?:|from \w[\w.]* import |elif |print\()/m],
  ["typescript", /\binterface \w+|:\s*(string|number|boolean|void)\b|\btype \w+ =|<\w+>\(/],
  // Sans accolade entre le sélecteur et la déclaration : la recherche s'arrête
  // au bloc suivant au lieu de reparcourir tout le texte depuis chaque "{".
  ["css", /^[\w.#:, \t>-]+\{[ \t]*$[^{}]*?:[ \t]*[^;\n]+;/m],
  ["javascript", /\b(const|let|var|function)\b|=>|require\(|console\.log/],
  ["bash", /^[ \t]*(#!\/|sudo |apt |npm |pnpm |npx |git |cd |export \w+=|echo )/m],
  ["yaml", /^[\w-]+:\s*(\S.*)?$/m],
];

/** Langage deviné par quelques mots-clés, ou "text". */
export function guessLanguage(text: string): string {
  const trimmed = text.trim();
  if (/^[[{]/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Pas du JSON valide : on continue avec les autres indices.
    }
  }
  return LANGUAGE_HINTS.find(([, pattern]) => pattern.test(text))?.[0] ?? "text";
}

const KNOWN_LANGUAGES = new Set<string>([
  ...CODE_LANGUAGES.map((language) => language.value),
  "tsx",
  "jsx",
  "kotlin",
  "swift",
  "csharp",
  "docker",
]);

const EDITOR_MODE_ALIASES: Record<string, string> = {
  typescriptreact: "tsx",
  javascriptreact: "jsx",
  shellscript: "bash",
  plaintext: "text",
  dockerfile: "docker",
};

/**
 * Langage annoncé par l'éditeur d'où vient le texte. VS Code place une donnée
 * `vscode-editor-data` dont le champ `mode` porte son identifiant de langage.
 */
export function languageFromEditor(editorData: string): string | null {
  if (!editorData) return null;
  let mode: unknown;
  try {
    mode = (JSON.parse(editorData) as { mode?: unknown }).mode;
  } catch {
    return null;
  }
  if (typeof mode !== "string") return null;
  const language = EDITOR_MODE_ALIASES[mode] ?? mode;
  return KNOWN_LANGUAGES.has(language) ? language : null;
}

/** Vrai si la position tombe dans un bloc de code ouvert et pas encore refermé. */
export function isInsideCodeFence(value: string, position: number): boolean {
  const fences = value
    .slice(0, position)
    .split("\n")
    .filter((line) => /^\s*(```|~~~)/.test(line));
  return fences.length % 2 === 1;
}
