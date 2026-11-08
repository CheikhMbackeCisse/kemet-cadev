// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Bloc introuvable : ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

function token(source: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(source);
  if (!match?.[1]) throw new Error(`Variable introuvable : --${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const themes = {
  clair: block(":root {"),
  "sombre (système)": block(':root:not([data-theme="light"]) {'),
  "sombre (choix manuel)": block(':root[data-theme="dark"] {'),
};

describe("badge de niveau", () => {
  it.each(Object.entries(themes))("garde 4,5:1 en thème %s", (_theme, source) => {
    const ratio = contrast(token(source, "level-badge-text"), token(source, "accent-soft-2"));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe("monogramme d'espace inactif", () => {
  it.each(Object.entries(themes))("garde 4,5:1 en thème %s", (_theme, source) => {
    const ratio = contrast(token(source, "link"), token(source, "accent-soft"));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

const LEVELS = ["apprenti", "artisan", "scribe", "architecte", "legende"] as const;

describe("icônes de niveau", () => {
  // Couleur de l'icône et du nom du niveau sur le profil : texte compris.
  it.each(Object.entries(themes))("gardent 4,5:1 sur le fond et au survol en thème %s", (_theme, source) => {
    for (const level of LEVELS) {
      for (const background of ["bg", "surface", "surface-2"]) {
        expect(contrast(token(source, `level-${level}`), token(source, background))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
