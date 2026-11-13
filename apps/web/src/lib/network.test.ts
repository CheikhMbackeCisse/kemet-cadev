import { describe, expect, it } from "vitest";
import { isSlowConnection } from "./network.js";

describe("isSlowConnection", () => {
  it("compte l'économie de données et la 3G ou moins comme lentes", () => {
    expect(isSlowConnection({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "3g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "2g" })).toBe(true);
    expect(isSlowConnection({ effectiveType: "slow-2g" })).toBe(true);
  });

  it("compte la 4G et l'absence d'information comme normales", () => {
    expect(isSlowConnection({ effectiveType: "4g" })).toBe(false);
    expect(isSlowConnection({})).toBe(false);
  });
});
