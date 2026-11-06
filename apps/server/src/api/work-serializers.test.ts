import { describe, expect, it } from "vitest";
import { toExcerpt } from "./work-serializers.js";

describe("toExcerpt", () => {
  it("retire titres, puces, liens et blocs de code, sans toucher aux identifiants", () => {
    const markdown = [
      "## Ce que j'ai fait",
      "",
      "- une `file_locale`",
      "1. un [lien](https://exemple.com)",
      "```sql",
      "select 1;",
      "```",
    ].join("\n");
    expect(toExcerpt(markdown)).toBe("Ce que j'ai fait une file_locale un lien");
  });

  it("coupe un long résumé", () => {
    const excerpt = toExcerpt("mot ".repeat(200));
    expect(excerpt.length).toBeLessThanOrEqual(221);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
