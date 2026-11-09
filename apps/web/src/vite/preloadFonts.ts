import type { Plugin } from "vite";

// Polices du premier affichage : texte courant et titres, sous-ensemble latin.
// Sans préchargement, le navigateur ne les découvre qu'après avoir lu le CSS,
// soit un aller-retour de plus (2 s en 3G) avant le texte définitif.
export const PRELOADED_FONT_PATTERNS = [
  /^assets\/plus-jakarta-sans-latin-400-normal-[\w-]+\.woff2$/,
  /^assets\/space-grotesk-latin-wght-normal-[\w-]+\.woff2$/,
];

/** Balises de préchargement pour les fichiers de police qui correspondent aux motifs. */
export function fontPreloadTags(fileNames: string[], patterns: RegExp[] = PRELOADED_FONT_PATTERNS): string {
  return patterns
    .map((pattern) => fileNames.find((fileName) => pattern.test(fileName)))
    .filter((fileName): fileName is string => fileName !== undefined)
    .map((fileName) => `<link rel="preload" href="/${fileName}" as="font" type="font/woff2" crossorigin>`)
    .join("\n    ");
}

export function preloadFonts(): Plugin {
  return {
    name: "kemet-preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        const tags = fontPreloadTags(Object.keys(context.bundle ?? {}));
        return tags ? html.replace("</title>", `</title>\n    ${tags}`) : html;
      },
    },
  };
}
