import type { TechLogoName } from "./techLogos.js";

export type FloatingSymbol = "ai" | "security" | "iot";

export type FloatingContent =
  | { kind: "logo"; name: TechLogoName }
  | { kind: "symbol"; name: FloatingSymbol }
  | { kind: "code"; text: string };

export interface FloatingItem {
  content: FloatingContent;
  /** Place de l'élément, en pourcentage de l'écran. */
  left: number;
  top: number;
  /** Taille en pixels : côté d'une icône, corps d'un bout de code. */
  size: number;
  /** Écart de la dérive, en pixels, et rotation, en degrés. */
  dx: number;
  dy: number;
  rotate: number;
  /** Durée d'un aller-retour, en secondes, et décalage de départ. */
  duration: number;
  delay: number;
  /** Gardé sur téléphone, où l'écran ne laisse la place qu'à une partie. */
  mobile: boolean;
}

// Places fixes plutôt qu'aléatoires : le même écran à chaque visite, et rien
// qui change entre deux rendus. Seize au plus, pour un téléphone d'entrée de
// gamme.
export const FLOATING_ITEMS: readonly FloatingItem[] = [
  { content: { kind: "logo", name: "python" }, left: 8, top: 14, size: 40, dx: 28, dy: -36, rotate: 8, duration: 19, delay: -3, mobile: true },
  { content: { kind: "code", text: "async function" }, left: 30, top: 8, size: 15, dx: 36, dy: 18, rotate: 0, duration: 23, delay: -11, mobile: false },
  { content: { kind: "logo", name: "react" }, left: 72, top: 10, size: 44, dx: -30, dy: 26, rotate: -12, duration: 21, delay: -7, mobile: true },
  { content: { kind: "symbol", name: "ai" }, left: 88, top: 30, size: 36, dx: -24, dy: -30, rotate: 10, duration: 18, delay: -14, mobile: true },
  { content: { kind: "code", text: 'print("Hello, World!")' }, left: 4, top: 38, size: 14, dx: 30, dy: 24, rotate: -4, duration: 25, delay: -5, mobile: false },
  { content: { kind: "logo", name: "javascript" }, left: 18, top: 60, size: 36, dx: -22, dy: -34, rotate: -10, duration: 20, delay: -9, mobile: true },
  { content: { kind: "logo", name: "docker" }, left: 84, top: 56, size: 42, dx: 26, dy: 30, rotate: 6, duration: 22, delay: -2, mobile: true },
  { content: { kind: "code", text: "git push" }, left: 62, top: 78, size: 15, dx: -34, dy: -20, rotate: 3, duration: 24, delay: -16, mobile: true },
  { content: { kind: "symbol", name: "security" }, left: 6, top: 84, size: 38, dx: 32, dy: -26, rotate: -8, duration: 19, delay: -12, mobile: true },
  { content: { kind: "logo", name: "flutter" }, left: 46, top: 22, size: 34, dx: -26, dy: 32, rotate: 12, duration: 26, delay: -6, mobile: false },
  { content: { kind: "code", text: "<div>" }, left: 92, top: 82, size: 16, dx: -30, dy: -28, rotate: -6, duration: 21, delay: -18, mobile: true },
  { content: { kind: "logo", name: "nodedotjs" }, left: 36, top: 88, size: 40, dx: 24, dy: -30, rotate: 8, duration: 23, delay: -4, mobile: false },
  { content: { kind: "symbol", name: "iot" }, left: 56, top: 52, size: 38, dx: 30, dy: 26, rotate: -10, duration: 20, delay: -10, mobile: false },
  { content: { kind: "logo", name: "go" }, left: 24, top: 30, size: 46, dx: 26, dy: 22, rotate: 0, duration: 24, delay: -15, mobile: false },
  { content: { kind: "code", text: "0x1F" }, left: 70, top: 36, size: 16, dx: -28, dy: -24, rotate: 6, duration: 18, delay: -8, mobile: true },
  { content: { kind: "logo", name: "linux" }, left: 76, top: 92, size: 36, dx: -24, dy: 30, rotate: -6, duration: 22, delay: -13, mobile: false },
];
