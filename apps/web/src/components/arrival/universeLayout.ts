import type { DeviconName } from "./deviconLogos.js";

/**
 * Fond de "Complète ton profil" : l'univers de l'informatique à trois
 * profondeurs. "back" passe derrière la carte en verre, "front" jamais
 * (ProfileUniverse cache celui qui la toucherait).
 */
export type UniverseDepth = "back" | "middle" | "front";

export type UniverseIcon = "terminal" | "database" | "network" | "cpu";

/** Morceau d'un bout de code, coloré par les variables --code-cover-*. */
export interface CodeToken {
  text: string;
  tone?: "keyword" | "string";
}

export type UniverseContent =
  | { kind: "logo"; name: DeviconName }
  | { kind: "icon"; name: UniverseIcon }
  | { kind: "code"; tokens: readonly CodeToken[] };

export type UniverseScreen = "mobile" | "desktop";

export interface UniverseItem {
  content: UniverseContent;
  depth: UniverseDepth;
  /** Centre de l'élément, en pourcentage de l'écran. */
  x: number;
  y: number;
  /** Durée d'un aller-retour de la flottaison, en secondes. */
  duration: number;
}

/** Côté d'un logo (pastille comprise au premier plan), d'une icône, et corps du code, en pixels. */
export const UNIVERSE_SIZES: Record<
  UniverseScreen,
  Record<UniverseDepth, { logo: number; icon: number; codeFont: number }>
> = {
  desktop: {
    back: { logo: 26, icon: 22, codeFont: 11 },
    middle: { logo: 36, icon: 26, codeFont: 12 },
    front: { logo: 52, icon: 30, codeFont: 13 },
  },
  mobile: {
    back: { logo: 18, icon: 16, codeFont: 10 },
    middle: { logo: 24, icon: 20, codeFont: 10 },
    front: { logo: 36, icon: 22, codeFont: 11 },
  },
};

const logo = (name: DeviconName) => ({ kind: "logo", name }) as const;
const icon = (name: UniverseIcon) => ({ kind: "icon", name }) as const;
const code = (...tokens: CodeToken[]) => ({ kind: "code", tokens }) as const;

export const UNIVERSE_CODE = {
  hello: code({ text: "print", tone: "keyword" }, { text: "(" }, { text: '"Hello, World!"', tone: "string" }, { text: ")" }),
  gitPush: code({ text: "git", tone: "keyword" }, { text: " push origin main" }),
  kemet: code(
    { text: "const", tone: "keyword" },
    { text: " kemet = " },
    { text: "new", tone: "keyword" },
    { text: " Communaute()" },
  ),
  select: code(
    { text: "SELECT", tone: "keyword" },
    { text: " * " },
    { text: "FROM", tone: "keyword" },
    { text: " devs " },
    { text: "WHERE", tone: "keyword" },
    { text: " pays = " },
    { text: "'SN'", tone: "string" },
    { text: ";" },
  ),
  flutterRun: code({ text: "flutter", tone: "keyword" }, { text: " run" }),
} as const;

const { hello, gitPush, kemet, select, flutterRun } = UNIVERSE_CODE;

// Places fixes : le même écran à chaque visite. Sur ordinateur, la carte
// occupe le centre (environ 34 à 66 % en largeur) : le premier plan reste
// dans les deux grandes zones de côté, l'arrière-plan peut passer derrière
// le verre. Sur téléphone, dix éléments, surtout en haut et en bas.
export const UNIVERSE: Record<UniverseScreen, readonly UniverseItem[]> = {
  desktop: [
    { content: logo("python"), depth: "front", x: 10, y: 16, duration: 19 },
    { content: hello, depth: "front", x: 19, y: 33, duration: 23 },
    { content: logo("javascript"), depth: "front", x: 27, y: 53, duration: 21 },
    { content: icon("terminal"), depth: "front", x: 8, y: 68, duration: 17 },
    { content: select, depth: "front", x: 17, y: 86, duration: 25 },
    { content: logo("typescript"), depth: "front", x: 90, y: 14, duration: 20 },
    { content: kemet, depth: "front", x: 82, y: 31, duration: 24 },
    { content: logo("flutter"), depth: "front", x: 74, y: 50, duration: 22 },
    { content: icon("database"), depth: "front", x: 93, y: 58, duration: 18 },
    { content: gitPush, depth: "front", x: 85, y: 75, duration: 26 },
    { content: logo("react"), depth: "front", x: 72, y: 89, duration: 19 },
    { content: logo("go"), depth: "middle", x: 4, y: 44, duration: 27 },
    { content: logo("nodejs"), depth: "middle", x: 38, y: 9, duration: 29 },
    { content: logo("html5"), depth: "middle", x: 61, y: 7, duration: 28 },
    { content: logo("postgresql"), depth: "middle", x: 97, y: 40, duration: 26 },
    { content: logo("dart"), depth: "middle", x: 35, y: 93, duration: 30 },
    { content: logo("git"), depth: "middle", x: 63, y: 94, duration: 27 },
    { content: icon("network"), depth: "middle", x: 52, y: 4, duration: 25 },
    { content: icon("cpu"), depth: "middle", x: 4, y: 92, duration: 28 },
    { content: logo("java"), depth: "back", x: 42, y: 30, duration: 33 },
    { content: logo("php"), depth: "back", x: 58, y: 68, duration: 31 },
    { content: logo("css3"), depth: "back", x: 31, y: 74, duration: 34 },
    { content: logo("linux"), depth: "back", x: 67, y: 24, duration: 32 },
    { content: logo("docker"), depth: "back", x: 96, y: 88, duration: 35 },
    { content: flutterRun, depth: "back", x: 50, y: 52, duration: 36 },
  ],
  mobile: [
    { content: logo("python"), depth: "front", x: 14, y: 12, duration: 19 },
    { content: gitPush, depth: "front", x: 52, y: 10, duration: 24 },
    { content: logo("typescript"), depth: "front", x: 88, y: 13, duration: 20 },
    { content: logo("javascript"), depth: "front", x: 14, y: 89, duration: 21 },
    { content: flutterRun, depth: "front", x: 50, y: 92, duration: 23 },
    { content: logo("react"), depth: "front", x: 86, y: 88, duration: 22 },
    { content: logo("docker"), depth: "middle", x: 34, y: 18, duration: 28 },
    { content: logo("nodejs"), depth: "middle", x: 70, y: 19, duration: 27 },
    { content: logo("postgresql"), depth: "back", x: 6, y: 50, duration: 33 },
    { content: logo("go"), depth: "back", x: 94, y: 46, duration: 31 },
  ],
};

/** Largeur et hauteur d'un élément, dérive non comprise. */
export function universeItemSize(item: UniverseItem, screen: UniverseScreen): [number, number] {
  const sizes = UNIVERSE_SIZES[screen][item.depth];
  switch (item.content.kind) {
    case "logo":
      return [sizes.logo, sizes.logo];
    case "icon":
      return [sizes.icon, sizes.icon];
    case "code": {
      // Chasse fixe de Geist Mono : 0,6 em par caractère.
      const length = item.content.tokens.reduce((total, token) => total + token.text.length, 0);
      return [Math.ceil(length * sizes.codeFont * 0.6), Math.ceil(sizes.codeFont * 1.5)];
    }
  }
}
