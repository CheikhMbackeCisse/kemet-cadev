import { describe, expect, it } from "vitest";
import { levelForPoints } from "@kemet/shared";
import { pointsAtShareOfLevel } from "./prepare-account.js";

describe("points visés", () => {
  it("place le compte à 40 % du chemin de Scribe vers Architecte", () => {
    expect(pointsAtShareOfLevel("scribe", 0.4)).toBe(1600);
    expect(levelForPoints(pointsAtShareOfLevel("scribe", 0.4))).toBe("scribe");
  });

  it("refuse le dernier niveau, qui n'a pas de suivant", () => {
    expect(() => pointsAtShareOfLevel("legende", 0.4)).toThrow();
  });
});
