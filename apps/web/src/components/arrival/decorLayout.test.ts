import { describe, expect, it } from "vitest";
import {
  DECOR,
  DECOR_DRIFT,
  DECOR_MIN_BAND,
  decorItemSize,
  type DecorBandSide,
  type DecorScreen,
} from "./decorLayout.js";

// Écart minimal avec le bord d'une bande (le bord de l'écran, ou la carte
// et sa marge de 16 px) et entre deux éléments, dérive comprise.
const EDGE = 16;
const GAP = 12;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boxes(screen: DecorScreen, side: DecorBandSide, width: number, height: number): Box[] {
  return DECOR[screen][side].map((item) => {
    const [w, h] = decorItemSize(item.content, screen);
    const x = (item.x / 100) * width;
    const y = (item.y / 100) * height;
    return {
      left: x - w / 2 - DECOR_DRIFT,
      right: x + w / 2 + DECOR_DRIFT,
      top: y - h / 2 - DECOR_DRIFT,
      bottom: y + h / 2 + DECOR_DRIFT,
    };
  });
}

function apart(a: Box, b: Box): boolean {
  return (
    a.right + GAP <= b.left ||
    b.right + GAP <= a.left ||
    a.bottom + GAP <= b.top ||
    b.bottom + GAP <= a.top
  );
}

const SCREENS: DecorScreen[] = ["mobile", "desktop"];
const SIDES: DecorBandSide[] = ["start", "end"];

describe("décor du parcours d'arrivée", () => {
  it("compte dix éléments au plus sur ordinateur, six sur téléphone", () => {
    expect(DECOR.desktop.start.length + DECOR.desktop.end.length).toBeLessThanOrEqual(10);
    expect(DECOR.mobile.start.length + DECOR.mobile.end.length).toBeLessThanOrEqual(6);
  });

  it("garde trois à cinq logos et deux ou trois bouts de code", () => {
    for (const screen of SCREENS) {
      const items = [...DECOR[screen].start, ...DECOR[screen].end];
      const logos = new Set(
        items.flatMap((item) => (item.content.kind === "logo" ? [item.content.name] : [])),
      );
      const code = items.filter((item) => item.content.kind === "code");
      expect(logos.size).toBeGreaterThanOrEqual(3);
      expect(logos.size).toBeLessThanOrEqual(5);
      expect(code.length).toBeGreaterThanOrEqual(1);
      expect(code.length).toBeLessThanOrEqual(3);
    }
  });

  // Les places sont en pourcentage de la bande : une bande plus grande
  // n'éloigne que davantage les éléments entre eux et des bords. Vérifier la
  // plus petite bande qui montre le décor suffit.
  for (const screen of SCREENS) {
    for (const side of SIDES) {
      const { width, height } = DECOR_MIN_BAND[screen];

      it(`${screen}, bande ${side} : rien contre un bord`, () => {
        for (const box of boxes(screen, side, width, height)) {
          expect(box.left).toBeGreaterThanOrEqual(EDGE);
          expect(box.top).toBeGreaterThanOrEqual(EDGE);
          expect(box.right).toBeLessThanOrEqual(width - EDGE);
          expect(box.bottom).toBeLessThanOrEqual(height - EDGE);
        }
      });

      it(`${screen}, bande ${side} : aucun élément sur un autre`, () => {
        const placed = boxes(screen, side, width, height);
        placed.forEach((box, index) => {
          for (const other of placed.slice(index + 1)) expect(apart(box, other)).toBe(true);
        });
      });
    }
  }
});
