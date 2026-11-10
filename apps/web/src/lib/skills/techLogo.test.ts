import { describe, expect, it } from "vitest";
import { techLogoFor } from "./techLogo.js";

describe("techLogoFor", () => {
  it("préfère le premier texte qui nomme une technologie", () => {
    expect(techLogoFor(["flutter offline-first", "dart"])).toBe("flutter");
    expect(techLogoFor(["paiement mobile", "ts"])).toBe("typescript");
  });

  it("ne prend pas un mot court au milieu d'un autre", () => {
    expect(techLogoFor(["design system", "thème"])).toBeNull();
    expect(techLogoFor(["golang"])).toBe("go");
  });
});
