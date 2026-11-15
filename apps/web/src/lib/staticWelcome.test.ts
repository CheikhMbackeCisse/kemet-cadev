import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fr } from "../i18n/fr.js";
import { releaseStaticWelcome } from "./staticWelcome.js";

const indexHtml = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
const themeInit = readFileSync(resolve(import.meta.dirname, "../../public/theme-init.js"), "utf8");

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

  it("est retiré avec son attribut", () => {
    document.body.innerHTML = '<div id="static-welcome"></div>';
    document.documentElement.setAttribute("data-static-welcome", "");
    releaseStaticWelcome();
    expect(document.getElementById("static-welcome")).toBeNull();
    expect(document.documentElement.hasAttribute("data-static-welcome")).toBe(false);
  });
});
