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
  it.each(Object.entries(themes))(
    "gardent 4,5:1 sur le fond et au survol en thème %s",
    (_theme, source) => {
      for (const level of LEVELS) {
        for (const background of ["bg", "surface", "surface-2"]) {
          expect(
            contrast(token(source, `level-${level}`), token(source, background)),
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );
});

describe("carte en verre dépoli du parcours d'arrivée", () => {
  // Les variables du fond de marque vivent dans leur propre bloc :root.
  const start = css.indexOf("--auth-bg-from");
  const root = css.slice(start, css.indexOf("}", start));

  function rgb(hex: string): [number, number, number] {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }

  function hex([r, g, b]: [number, number, number]): string {
    return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  /** `top` posé à l'opacité `alpha` sur `bottom`. */
  function over(top: string, alpha: number, bottom: string): string {
    const [a, b] = [rgb(top), rgb(bottom)];
    return hex(
      [0, 1, 2].map((i) => a[i]! * alpha + b[i]! * (1 - alpha)) as [number, number, number],
    );
  }

  function number(name: string): number {
    const match = new RegExp(`--${name}:\\s*([0-9.]+)`).exec(root);
    if (!match?.[1]) throw new Error(`Variable introuvable : --${name}`);
    return Number(match[1]);
  }

  // Pire cas, sans compter le flou qui l'adoucit : un élément flottant blanc à
  // son opacité maximale, sur le halo le plus clair pris à pleine intensité.
  const backdrop = over("#ffffff", number("auth-float-opacity"), token(root, "auth-glow-a"));
  const card = over(token(root, "auth-glass"), number("auth-glass-opacity"), backdrop);
  // --auth-text-muted est un blanc à 72 %.
  const muted = over("#ffffff", 0.72, card);

  it("garde 4,5:1 pour le texte, le texte secondaire et les erreurs", () => {
    expect(contrast(token(root, "auth-text"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(root, "auth-danger"), card)).toBeGreaterThanOrEqual(4.5);
  });

  it("garde 3:1 pour un insigne de niveau posé sur la carte", () => {
    const onDark = block(".level-on-dark");
    for (const level of LEVELS) {
      expect(contrast(token(onDark, `level-${level}`), card)).toBeGreaterThanOrEqual(3);
    }
  });

  it("ne dépasse jamais l'opacité prévue pour les éléments flottants derrière un formulaire", () => {
    const component = readFileSync(
      new URL("../components/arrival/ArrivalBackground.tsx", import.meta.url),
      "utf8",
    );
    // Sur l'accueil (mouvement riche), les logos sont en couleur sur une
    // pastille blanche et peuvent monter plus haut : seul le mouvement calme,
    // derrière les formulaires, reste sous ce plafond.
    const calm = /calm: \{[^}]*high: ([0-9.]+)/.exec(component);
    expect(calm).not.toBeNull();
    expect(Number(calm![1])).toBeLessThanOrEqual(number("auth-float-opacity"));
  });
});
