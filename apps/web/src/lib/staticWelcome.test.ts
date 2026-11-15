import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fr } from "../i18n/fr.js";
import { releaseStaticWelcome } from "./staticWelcome.js";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
const themeInit = readFileSync(resolve(import.meta.dirname, "../../public/theme-init.js"), "utf8");
const tokens = readFileSync(resolve(import.meta.dirname, "../styles/tokens.css"), "utf8");
const wordmark = readFileSync(
  resolve(import.meta.dirname, "../../public/brand/kemet-wordmark-dark.svg"),
  "utf8",
);

/** Valeur d'une variable dans le premier bloc de tokens.css qui la déclare après `after`. */
function token(name: string, after = ":root {"): string {
  const start = tokens.indexOf(after);
  const match = tokens.slice(start).match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--${name} introuvable`);
  return match[1]!.trim().toLowerCase();
}

function hexToRgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

describe("accueil statique d'index.html", () => {
  it("reprend mot pour mot les textes de l'accueil", () => {
    const decode = (html: string) => html.replace(/&#39;/g, "'");
    const text = decode(indexHtml);
    for (const value of [
      fr.intro.welcomeTitle,
      fr.intro.welcomePromise,
      fr.intro.start,
      fr.intro.explore,
      fr.intro.poweredBy,
    ]) {
      expect(text).toContain(`>${value}<`);
    }
  });

  it("mène aux mêmes pages que les boutons de l'accueil", () => {
    expect(indexHtml).toContain('class="sw-start" href="/inscription"');
    expect(indexHtml).toContain('class="sw-explore" href="/fil"');
  });

  it("n'est montré par theme-init.js que sur l'accueil", () => {
    expect(themeInit).toContain('setAttribute("data-static-welcome"');
    expect(themeInit).toContain(String.raw`path === "/" || /^\/decouvrir\/?$/.test(path)`);
  });

  it("recopie le logo sans le modifier", () => {
    const inline = indexHtml.match(/<svg class="sw-logo" [\s\S]*?<\/svg>/)![0];
    expect(inline.replace('<svg class="sw-logo" ', "<svg ")).toBe(wordmark.trim());
  });

  it("recopie les couleurs et l'arrondi des tokens du parcours d'arrivée", () => {
    const html = indexHtml.toLowerCase();
    const dark = "@media (prefers-color-scheme: dark)";
    expect(html).toContain(`--sw-from: ${token("auth-bg-from")}; --sw-to: ${token("auth-bg-to")};`);
    expect(html).toContain(
      `--sw-from: ${token("auth-bg-from", dark)}; --sw-to: ${token("auth-bg-to", dark)};`,
    );
    const glassOpacity = token("auth-glass-clear-opacity");
    expect(html).toContain(`background-color: rgba(${hexToRgb(token("auth-glass"))}, ${glassOpacity});`);
    expect(html).toContain(`border: 1px solid ${token("auth-glass-border")};`);
    expect(html).toContain(`color: ${token("auth-text-muted")};`);
    expect(html).toContain(`background-color: ${token("auth-button-hover")};`);
    expect(html).toContain(`border-radius: ${token("radius-panel")};`);
  });

  it("est retiré avec son attribut", () => {
    document.body.innerHTML = '<div id="static-welcome"></div>';
    document.documentElement.setAttribute("data-static-welcome", "");
    releaseStaticWelcome();
    expect(document.getElementById("static-welcome")).toBeNull();
    expect(document.documentElement.hasAttribute("data-static-welcome")).toBe(false);
  });
});
