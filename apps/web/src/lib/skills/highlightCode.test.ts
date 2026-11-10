import { describe, expect, it } from "vitest";
import { highlightLine } from "./highlightCode.js";

describe("highlightLine", () => {
  it("repère mots-clés, chaînes et commentaires", () => {
    expect(highlightLine('const url = "https://x" // appel')).toEqual([
      { kind: "keyword", text: "const" },
      { kind: "text", text: " url = " },
      { kind: "string", text: '"https://x"' },
      { kind: "text", text: " " },
      { kind: "comment", text: "// appel" },
    ]);
  });

  it("rend la ligne entière, sans perdre un caractère", () => {
    const line = "if (a-b > 2) { return x/2 } # fin";
    expect(highlightLine(line).map((token) => token.text).join("")).toBe(line);
  });
});
