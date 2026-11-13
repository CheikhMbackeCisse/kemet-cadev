import { describe, expect, it } from "vitest";
import { UNIVERSE, universeItemSize, type UniverseItem } from "./universeLayout.js";

function codeText(item: UniverseItem): string | null {
  return item.content.kind === "code"
    ? item.content.tokens.map((token) => token.text).join("")
    : null;
}

describe("fond de Complète ton profil", () => {
  it("montre sur ordinateur les seize logos, les cinq bouts de code et quatre icônes", () => {
    const items = UNIVERSE.desktop;
    const logos = new Set(items.flatMap((item) => (item.content.kind === "logo" ? [item.content.name] : [])));
    expect(logos.size).toBe(16);
    expect([...logos]).not.toContain("kotlin");
    expect(items.flatMap((item) => codeText(item) ?? []).sort()).toEqual(
      [
        'print("Hello, World!")',
        "git push origin main",
        "const kemet = new Communaute()",
        "SELECT * FROM devs WHERE pays = 'SN';",
        "flutter run",
      ].sort(),
    );
    expect(items.filter((item) => item.content.kind === "icon")).toHaveLength(4);
  });

  it("garde huit à dix éléments sur téléphone, le premier plan en haut et en bas", () => {
    expect(UNIVERSE.mobile.length).toBeGreaterThanOrEqual(8);
    expect(UNIVERSE.mobile.length).toBeLessThanOrEqual(10);
    for (const item of UNIVERSE.mobile.filter((entry) => entry.depth === "front")) {
      expect(item.y < 20 || item.y > 80).toBe(true);
    }
  });

  // Carte d'un formulaire sur un écran de 1440 x 900 : 448 px au centre.
  it("laisse le premier plan hors de la colonne de la carte sur ordinateur", () => {
    const width = 1440;
    const cardLeft = (width - 448) / 2;
    const cardRight = cardLeft + 448;
    for (const item of UNIVERSE.desktop.filter((entry) => entry.depth === "front")) {
      const [w] = universeItemSize(item, "desktop");
      const center = (item.x / 100) * width;
      const apart = center + w / 2 + 16 <= cardLeft || center - w / 2 - 16 >= cardRight;
      expect(apart, codeText(item) ?? item.content.kind).toBe(true);
    }
  });

  it("ne cite personne : aucune phrase, seulement du code", () => {
    for (const item of [...UNIVERSE.desktop, ...UNIVERSE.mobile]) {
      const text = codeText(item);
      if (text) expect(text).not.toMatch(/«|»|“|”/);
    }
  });
});
