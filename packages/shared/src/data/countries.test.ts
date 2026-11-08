import { describe, expect, it } from "vitest";
import { AFRICAN_COUNTRY_CODES, COUNTRY_CODES } from "./countries.js";

describe("AFRICAN_COUNTRY_CODES", () => {
  it("compte les 54 États africains, chacun une fois et présent dans la liste complète", () => {
    expect(AFRICAN_COUNTRY_CODES).toHaveLength(54);
    expect(new Set(AFRICAN_COUNTRY_CODES).size).toBe(54);
    for (const code of AFRICAN_COUNTRY_CODES) expect(COUNTRY_CODES).toContain(code);
  });
});
