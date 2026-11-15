import type { Plugin } from "vite";

const APP_STYLESHEET = /<link rel="stylesheet"( crossorigin)? href="(\/assets\/index-[\w-]+\.css)">/;

/**
 * Remplace la feuille de style de l'application par un préchargement : elle
 * ne bloque plus le premier affichage, et main.tsx l'applique avant de
 * monter React. L'accueil statique d'index.html a son propre style en ligne.
 */
export function deferStylesheetTag(html: string): string {
  return html.replace(
    APP_STYLESHEET,
    (_match, crossorigin: string | undefined, href: string) =>
      `<link rel="preload" as="style"${crossorigin ?? ""} href="${href}" data-app-stylesheet>`,
  );
}

export function deferAppStylesheet(): Plugin {
  return {
    name: "kemet-defer-app-stylesheet",
    apply: "build",
    transformIndexHtml: { order: "post", handler: deferStylesheetTag },
  };
}
