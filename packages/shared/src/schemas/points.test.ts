import { describe, expect, it } from "vitest";
import { isLevelAtLeast, levelForPoints } from "./points.js";

describe("levelForPoints", () => {
  it("reste Apprenti sans points", () => {
    expect(levelForPoints(0)).toBe("apprenti");
  });

  it("franchit chaque seuil exactement au point indiqué", () => {
    expect(levelForPoints(299)).toBe("apprenti");
    expect(levelForPoints(300)).toBe("artisan");
    expect(levelForPoints(999)).toBe("artisan");
    expect(levelForPoints(1000)).toBe("scribe");
    expect(levelForPoints(2499)).toBe("scribe");
    expect(levelForPoints(2500)).toBe("architecte");
    expect(levelForPoints(4999)).toBe("architecte");
    expect(levelForPoints(5000)).toBe("legende");
  });

  it("ne redescend jamais sous Apprenti, même négatif", () => {
    expect(levelForPoints(-50)).toBe("apprenti");
  });
});

describe("isLevelAtLeast", () => {
  it("compare les niveaux dans leur ordre", () => {
    expect(isLevelAtLeast("apprenti", "artisan")).toBe(false);
    expect(isLevelAtLeast("artisan", "artisan")).toBe(true);
    expect(isLevelAtLeast("legende", "artisan")).toBe(true);
  });
});
