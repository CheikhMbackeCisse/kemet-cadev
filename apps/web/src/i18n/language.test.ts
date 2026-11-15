import { describe, expect, it } from "vitest";
import { localeOf, pickLanguage } from "./language.js";

describe("pickLanguage", () => {
  it("garde le français par défaut, quelle que soit la langue du navigateur", () => {
    expect(pickLanguage(null)).toBe("fr");
    expect(pickLanguage("de")).toBe("fr");
    expect(pickLanguage("fr")).toBe("fr");
  });

  it("passe en anglais seulement si l'anglais a été choisi", () => {
    expect(pickLanguage("en")).toBe("en");
  });

  it("formate dans la locale de la langue", () => {
    expect(localeOf("fr")).toBe("fr-FR");
    expect(localeOf("en")).toBe("en-GB");
  });
});
