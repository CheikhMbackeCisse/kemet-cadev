import { describe, expect, it } from "vitest";
import { INLINE_CODE, insertCode } from "./insertCode.js";

function at(value: string, start: number, end = start) {
  return { value, selectionStart: start, selectionEnd: end };
}

describe("insertCode", () => {
  it("insère un bloc vide avec le curseur à l'intérieur", () => {
    const result = insertCode(at("", 0), "python");
    expect(result.value).toBe("```python\n\n```");
    expect(result.selectionStart).toBe("```python\n".length);
    expect(result.selectionEnd).toBe(result.selectionStart);
  });

  it("place le bloc sur sa propre ligne au milieu d'un texte", () => {
    const result = insertCode(at("Voici:suite", 6), "bash");
    expect(result.value).toBe("Voici:\n```bash\n\n```\nsuite");
  });

  it("entoure la sélection et la garde sélectionnée", () => {
    const result = insertCode(at("a\nconst x = 1;\nb", 2, 14), "typescript");
    expect(result.value).toBe("a\n```typescript\nconst x = 1;\n```\nb");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("const x = 1;");
  });

  it("allonge la clôture quand la sélection contient déjà une clôture", () => {
    const result = insertCode(at("```js\nx\n```", 0, 11), "text");
    expect(result.value).toBe("````text\n```js\nx\n```\n````");
  });

  it("entoure la sélection de code en ligne", () => {
    const result = insertCode(at("lancer npm test ici", 7, 15), INLINE_CODE);
    expect(result.value).toBe("lancer `npm test` ici");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("npm test");
  });

  it("double les accents graves autour d'une sélection qui en contient", () => {
    const result = insertCode(at("a`b", 0, 3), INLINE_CODE);
    expect(result.value).toBe("`` a`b ``");
  });
});
