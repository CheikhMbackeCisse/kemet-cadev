import { describe, expect, it } from "vitest";
import { handleFromName } from "./slugify.js";

describe("handleFromName", () => {
  it("met en minuscules, sans accents ni espaces", () => {
    expect(handleFromName("Aïssatou Ndiaye")).toBe("aissatou-ndiaye");
    expect(handleFromName("  Cheikh   Mbacke Cisse ")).toBe("cheikh-mbacke-cisse");
    expect(handleFromName("Kéné O'Brien")).toBe("kene-o-brien");
  });

  it("s'arrête à 30 caractères sans finir par un tiret", () => {
    const handle = handleFromName("Abdoulaye Mamadou Sall Diop Ndiaye Fall");
    expect(handle.length).toBeLessThanOrEqual(30);
    expect(handle.endsWith("-")).toBe(false);
  });

  it("ne garde rien d'un nom sans lettre latine", () => {
    expect(handleFromName("!!!")).toBe("");
  });
});
