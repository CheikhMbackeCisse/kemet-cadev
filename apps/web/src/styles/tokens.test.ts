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

describe("icône d'un espace sans logo", () => {
  // Icône blanche sur la teinte propre à l'espace.
  it.each(Object.entries(themes))("garde 4,5:1 en thème %s", (_theme, source) => {
    for (let tint = 1; tint <= 12; tint += 1) {
      expect(contrast("#ffffff", token(source, `space-tint-${tint}`))).toBeGreaterThanOrEqual(4.5);
    }
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

  function rgbaAlpha(name: string): number {
    const match = new RegExp(`--${name}:\\s*rgba\\([^)]*,\\s*([0-9.]+)\\)`).exec(root);
    if (!match?.[1]) throw new Error(`Variable introuvable : --${name}`);
    return Number(match[1]);
  }

  // Pire cas, sans compter le flou qui l'adoucit : le contour du continent,
  // seul élément du décor qui passe sous la carte, sur le halo le plus clair
  // pris à pleine intensité. Le décor qui dérive reste dans ses bandes.
  const backdrop = over("#93c5fd", rgbaAlpha("auth-continent-line"), token(root, "auth-glow-a"));
  const card = over(token(root, "auth-glass"), number("auth-glass-opacity"), backdrop);
  // --auth-text-muted est un blanc à 72 %.
  const muted = over("#ffffff", 0.72, card);

  it("garde 4,5:1 pour le texte, le texte secondaire et les erreurs", () => {
    expect(contrast(token(root, "auth-text"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(root, "auth-danger"), card)).toBeGreaterThanOrEqual(4.5);
  });

  it("garde 4,5:1 sur la carte plus claire de l'accueil", () => {
    const clear = over(token(root, "auth-glass"), number("auth-glass-clear-opacity"), backdrop);
    expect(contrast(token(root, "auth-text"), clear)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(over("#ffffff", 0.72, clear), clear)).toBeGreaterThanOrEqual(4.5);
  });

  function rgbaColor(name: string): string {
    const match = new RegExp(`--${name}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),`).exec(root);
    if (!match) throw new Error(`Variable introuvable : --${name}`);
    return hex([Number(match[1]), Number(match[2]), Number(match[3])]);
  }

  it("ne trace jamais un arc du réseau plus fort que le contour du continent", () => {
    expect(rgbaColor("auth-network-line")).toBe(rgbaColor("auth-continent-line"));
    expect(rgbaAlpha("auth-network-line")).toBeLessThanOrEqual(rgbaAlpha("auth-continent-line"));
  });

  it("garde 4,5:1 sur la carte de l'accueil quand une capitale ou une lueur passe dessous", () => {
    // Sous la carte, points et lueurs tombent à --auth-network-covered-opacity.
    const covered = number("auth-network-covered-opacity");
    for (const name of ["auth-capital-dot", "auth-network-glow"]) {
      const under = over(token(root, name), covered, token(root, "auth-glow-a"));
      const clear = over(token(root, "auth-glass"), number("auth-glass-clear-opacity"), under);
      expect(contrast(token(root, "auth-text"), clear), name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(over("#ffffff", 0.72, clear), clear), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("garde 3:1 pour un insigne de niveau posé sur la carte", () => {
    const onDark = block(".level-on-dark");
    for (const level of LEVELS) {
      expect(contrast(token(onDark, `level-${level}`), card)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("couverture de code d'un skill", () => {
  const start = css.indexOf("--code-cover-bg");
  const root = css.slice(start, css.indexOf("}", start));

  it("garde 4,5:1 pour chaque couleur du code sur le fond de l'éditeur", () => {
    const background = token(root, "code-cover-bg");
    for (const name of ["text", "keyword", "string", "comment"]) {
      expect(contrast(token(root, `code-cover-${name}`), background), name).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

describe("état actif fort", () => {
  // Texte et icône sur le fond plein, et le fond lui-même sur la page et les
  // panneaux, où il marque l'élément actif sans bordure.
  it.each(Object.entries(themes))("garde 4,5:1 en thème %s", (_theme, source) => {
    for (const background of ["action-strong", "action-strong-hover"]) {
      expect(
        contrast(token(source, "on-action-strong"), token(source, background)),
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const page of ["bg", "surface", "surface-2"]) {
      expect(contrast(token(source, "action-strong"), token(source, page))).toBeGreaterThanOrEqual(
        3,
      );
    }
  });
});
