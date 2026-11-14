import type { DeviconName } from "./deviconLogos.js";

export type DecorIcon = "cpu" | "shield" | "network";

export type DecorContent =
  | { kind: "logo"; name: DeviconName }
  | { kind: "icon"; name: DecorIcon }
  | { kind: "code"; text: string };

export type DecorScreen = "mobile" | "desktop";
export type DecorBandSide = "start" | "end";

export interface DecorItem {
  content: DecorContent;
  /** Centre de l'élément, en pourcentage de sa bande. */
  x: number;
  y: number;
  /** Durée d'un aller-retour de la dérive, en secondes, et décalage de départ. */
  duration: number;
  delay: number;
}

/**
 * Côté d'une pastille de logo, d'une icône seule, et corps d'un bout de
 * code, en pixels. Lus par le rendu et par le test qui vérifie les places.
 */
export const DECOR_SIZES: Record<DecorScreen, { tile: number; icon: number; codeFont: number }> = {
  mobile: { tile: 38, icon: 22, codeFont: 11 },
  desktop: { tile: 52, icon: 30, codeFont: 12 },
};

/** Écart de la dérive autour de la place de chaque élément, en pixels. */
export const DECOR_DRIFT = 6;

/**
 * Taille minimale d'une bande pour qu'elle montre son décor, en pixels.
 * Sur téléphone, les bandes sont au-dessus et au-dessous de la carte ; sur
 * ordinateur, à sa gauche et à sa droite. En dessous, la bande reste vide :
 * un formulaire long sur un petit écran n'a aucun décor.
 */
export const DECOR_MIN_BAND: Record<DecorScreen, { width: number; height: number }> = {
  mobile: { width: 320, height: 110 },
  desktop: { width: 280, height: 420 },
};

const python = { kind: "logo", name: "python" } as const;
const pytorch = { kind: "logo", name: "pytorch" } as const;
const typescript = { kind: "logo", name: "typescript" } as const;
const react = { kind: "logo", name: "react" } as const;
const docker = { kind: "logo", name: "docker" } as const;
const cpu = { kind: "icon", name: "cpu" } as const;
const shield = { kind: "icon", name: "shield" } as const;
const network = { kind: "icon", name: "network" } as const;
const modelFit = { kind: "code", text: "model.fit(X_train, y_train)" } as const;
const sshKeygen = { kind: "code", text: "ssh-keygen -t ed25519" } as const;
const gitPush = { kind: "code", text: "git push origin main" } as const;
const gitPushShort = { kind: "code", text: "git push" } as const;
const kemet = { kind: "code", text: "const kemet = new Communaute()" } as const;

// Places fixes plutôt qu'aléatoires : le même écran à chaque visite. Douze
// éléments sur ordinateur (langages, IA, cybersécurité, infrastructure),
// cinq sur téléphone, vérifiés par decorLayout.test.ts : jamais l'un sur
// l'autre, jamais contre le bord de leur bande.
export const DECOR: Record<DecorScreen, Record<DecorBandSide, readonly DecorItem[]>> = {
  desktop: {
    start: [
      { content: python, x: 30, y: 12, duration: 19, delay: -3 },
      { content: modelFit, x: 50, y: 28, duration: 23, delay: -11 },
      { content: cpu, x: 22, y: 44, duration: 17, delay: -6 },
      { content: pytorch, x: 68, y: 56, duration: 21, delay: -14 },
      { content: kemet, x: 50, y: 73, duration: 25, delay: -2 },
      { content: react, x: 32, y: 88, duration: 20, delay: -9 },
    ],
    end: [
      { content: typescript, x: 70, y: 12.5, duration: 20, delay: -8 },
      { content: shield, x: 34, y: 28, duration: 18, delay: -12 },
      { content: gitPush, x: 56, y: 40, duration: 24, delay: -5 },
      { content: sshKeygen, x: 50, y: 51, duration: 22, delay: -15 },
      { content: docker, x: 32, y: 67, duration: 22, delay: -16 },
      { content: network, x: 74, y: 86, duration: 16, delay: -9 },
    ],
  },
  mobile: {
    start: [
      { content: python, x: 16, y: 45, duration: 19, delay: -3 },
      { content: gitPushShort, x: 50, y: 45, duration: 24, delay: -5 },
      { content: typescript, x: 84, y: 45, duration: 20, delay: -8 },
    ],
    end: [
      { content: modelFit, x: 38, y: 55, duration: 23, delay: -11 },
      { content: pytorch, x: 84, y: 55, duration: 21, delay: -14 },
    ],
  },
};

/** Largeur et hauteur de l'élément affiché, dérive non comprise. */
export function decorItemSize(content: DecorContent, screen: DecorScreen): [number, number] {
  const sizes = DECOR_SIZES[screen];
  switch (content.kind) {
    case "logo":
      return [sizes.tile, sizes.tile];
    case "icon":
      return [sizes.icon, sizes.icon];
    case "code":
      // Chasse fixe de Geist Mono : 0,6 em par caractère.
      return [
        Math.ceil(content.text.length * sizes.codeFont * 0.6),
        Math.ceil(sizes.codeFont * 1.5),
      ];
  }
}
