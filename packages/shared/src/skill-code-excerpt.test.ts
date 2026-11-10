import { describe, expect, it } from "vitest";
import { skillCodeExcerpt } from "./skill-code-excerpt.js";

describe("skillCodeExcerpt", () => {
  it("prend les six premières lignes du premier bloc et sa langue", () => {
    const content = [
      "# Titre",
      "Un paragraphe.",
      "```Dart title",
      ...Array.from({ length: 9 }, (_, index) => `ligne ${index + 1}`),
      "```",
    ].join("\n");
    expect(skillCodeExcerpt(content)).toEqual({
      language: "dart",
      lines: ["ligne 1", "ligne 2", "ligne 3", "ligne 4", "ligne 5", "ligne 6"],
    });
  });

  it("borne chaque ligne et retire les caractères de contrôle", () => {
    const excerpt = skillCodeExcerpt(`\`\`\`\n${"x".repeat(200)}\u0007\n\`\`\``);
    expect(excerpt.lines[0]).toHaveLength(72);
    expect(excerpt.language).toBeNull();
  });

  it("sans bloc de code, garde les premières lignes non vides", () => {
    expect(skillCodeExcerpt("Un\n\nDeux\nTrois").lines).toEqual(["Un", "Deux", "Trois"]);
  });
});
