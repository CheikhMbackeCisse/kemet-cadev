import { describe, expect, it } from "vitest";
import { frameRatio } from "./frameRatio.js";

describe("frameRatio", () => {
  it("garde les proportions de l'image entre 4:5 et 16:9", () => {
    expect(frameRatio({ width: 720, height: 720 }, false)).toBe(1);
    expect(frameRatio({ width: 1600, height: 900 }, true)).toBeCloseTo(16 / 9);
    expect(frameRatio({ width: 3000, height: 500 }, false)).toBeCloseTo(16 / 9);
    expect(frameRatio({ width: 390, height: 844 }, true)).toBeCloseTo(4 / 5);
  });

  it("retombe sur 16:9 ou un carré sans dimensions", () => {
    expect(frameRatio({ width: null, height: null }, false)).toBeCloseTo(16 / 9);
    expect(frameRatio({}, true)).toBe(1);
  });
});
