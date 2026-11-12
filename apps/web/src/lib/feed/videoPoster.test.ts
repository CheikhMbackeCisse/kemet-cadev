import { describe, expect, it } from "vitest";
import { posterSize, posterTime } from "./videoPoster.js";

describe("posterTime", () => {
  it("prend une image à une seconde, plus tôt pour une vidéo courte", () => {
    expect(posterTime(30)).toBe(1);
    expect(posterTime(2)).toBe(0.5);
    expect(posterTime(Number.POSITIVE_INFINITY)).toBe(0.1);
    expect(posterTime(Number.NaN)).toBe(0.1);
  });
});

describe("posterSize", () => {
  it("réduit l'aperçu à 720 px sur son plus grand côté, sans l'agrandir", () => {
    expect(posterSize(1920, 1080)).toEqual({ width: 720, height: 405 });
    expect(posterSize(1080, 1920)).toEqual({ width: 405, height: 720 });
    expect(posterSize(320, 180)).toEqual({ width: 320, height: 180 });
  });
});
