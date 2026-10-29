import type { HighlighterCore, ThemedToken } from "shiki/core";

// Shiki et chaque grammaire ne sont téléchargés qu'au premier bloc de code
// qui en a besoin : la plupart des pages n'en affichent aucun, et le bundle
// complet de Shiki pèse plusieurs mégaoctets.
const LANGUAGE_LOADERS = {
  bash: () => import("shiki/langs/bash.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  dart: () => import("shiki/langs/dart.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_LOADERS;

const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  dockerfile: "docker",
  golang: "go",
  js: "javascript",
  kt: "kotlin",
  py: "python",
  rs: "rust",
  ts: "typescript",
  yml: "yaml",
};

/** Nom de grammaire reconnu pour l'étiquette d'un bloc de code, ou null pour du texte brut. */
export function resolveLanguage(label: string | undefined): SupportedLanguage | null {
  if (!label) return null;
  const normalized = label.toLowerCase();
  if (normalized in LANGUAGE_LOADERS) return normalized as SupportedLanguage;
  return LANGUAGE_ALIASES[normalized] ?? null;
}

/** Au-delà, le bloc reste en texte brut. */
export const MAX_HIGHLIGHTED_CODE_LENGTH = 20_000;
const MAX_HIGHLIGHTED_LINE_LENGTH = 1_000;
const TOKENIZE_TIME_LIMIT_MS = 100;

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Map<SupportedLanguage, Promise<void>>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] =
      await Promise.all([
        import("shiki/core"),
        import("shiki/engine/javascript"),
        import("shiki/themes/github-light-high-contrast.mjs"),
        import("shiki/themes/github-dark-default.mjs"),
      ]);
    // Moteur d'expressions régulières JavaScript plutôt qu'Oniguruma : pas
    // de fichier WebAssembly de plus à télécharger.
    return createHighlighterCore({
      themes: [light.default, dark.default],
      langs: [],
      engine: createJavaScriptRegexEngine(),
    });
  })();
  return highlighterPromise;
}

/** Jetons colorés pour les deux thèmes, portés par les variables CSS --shiki-light et --shiki-dark. */
export async function highlight(
  code: string,
  language: SupportedLanguage,
): Promise<ThemedToken[][]> {
  const highlighter = await getHighlighter();
  let loading = loadedLanguages.get(language);
  if (!loading) {
    loading = LANGUAGE_LOADERS[language]().then((grammar) =>
      highlighter.loadLanguage(grammar.default),
    );
    loadedLanguages.set(language, loading);
  }
  await loading;
  return highlighter.codeToTokens(code, {
    lang: language,
    // Choisis pour le contraste sur --surface-2 : leur couleur la plus pâle
    // (commentaires) reste au-dessus de 4,5:1, contre 3,2:1 pour github-light
    // et github-dark.
    themes: { light: "github-light-high-contrast", dark: "github-dark-default" },
    defaultColor: false,
    // Bornes pour un contenu pathologique (skill ou réponse de l'assistant
    // très longs) : la coloration tourne sur le fil principal de la page.
    tokenizeMaxLineLength: MAX_HIGHLIGHTED_LINE_LENGTH,
    tokenizeTimeLimit: TOKENIZE_TIME_LIMIT_MS,
  }).tokens;
}
