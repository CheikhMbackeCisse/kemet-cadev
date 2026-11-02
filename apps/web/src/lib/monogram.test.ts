import { describe, expect, it } from "vitest";
import { monogramOf } from "./monogram.js";

describe("monogramOf", () => {
  it("prend les initiales des deux premiers mots porteurs de sens", () => {
    expect(monogramOf("Carrière & Freelance Tech")).toBe("CF");
    expect(monogramOf("Communauté des développeurs")).toBe("CD");
  });

  it("garde une seule lettre pour un nom d'un mot et un repli pour un nom vide", () => {
    expect(monogramOf("flutter")).toBe("F");
    expect(monogramOf("&&")).toBe("?");
  });
});
