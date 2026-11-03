import { describe, expect, it } from "vitest";
import {
  guessLanguage,
  isInsideCodeFence,
  languageFromEditor,
  looksLikeCode,
} from "./pasteCode.js";

describe("looksLikeCode", () => {
  it.each([
    ["une fonction TypeScript", "function add(a: number, b: number) {\n  return a + b;\n}"],
    ["du Python", "def add(a, b):\n    total = a + b\n    return total"],
    ["une commande shell", "pnpm install\npnpm db:migrate\npnpm dev"],
    ["du YAML", "services:\n  api:\n    image: kemet/api"],
  ])("reconnaît %s", (_name, text) => {
    expect(looksLikeCode(text)).toBe(true);
  });

  it.each([
    ["une seule ligne", "const x = 1;"],
    ["deux lignes", "const x = 1;\nconst y = 2;"],
    [
      "un paragraphe",
      "Bonjour à tous,\nje cherche quelqu'un pour relire mon projet.\nMerci d'avance pour votre aide.",
    ],
    ["une liste Markdown", "- relire le code\n- écrire les tests\n- publier la version"],
    ["un texte qui contient déjà un bloc", "Voici :\n```js\nconst x = 1;\n```"],
    ["un collage plus long qu'aucun champ", "key: value\n".repeat(3000)],
  ])("ignore %s", (_name, text) => {
    expect(looksLikeCode(text)).toBe(false);
  });
});

describe("guessLanguage", () => {
  it.each([
    ["typescript", "interface User {\n  name: string;\n}"],
    ["javascript", "const user = require('./user');\nconsole.log(user);"],
    ["python", "def add(a, b):\n    return a + b"],
    ["java", "public class App {\n  public static void main(String[] args) {}\n}"],
    ["dart", "void main() {\n  runApp(const App());\n}"],
    ["php", "<?php\n$name = 'Kemet';\necho $name;"],
    ["sql", "SELECT id, name\nFROM users\nWHERE level = 'scribe';"],
    ["bash", "#!/bin/sh\nset -e\npnpm install"],
    ["json", '{\n  "name": "kemet",\n  "private": true\n}'],
    ["html", '<div class="card">\n  <p>Kemet</p>\n</div>'],
    ["cpp", "#include <iostream>\nint main() {\n  std::cout << 1;\n}"],
    ["c", '#include <stdio.h>\nint main(void) {\n  printf("1");\n}'],
    ["go", "package main\n\nfunc main() {\n  x := 1\n}"],
    ["rust", "fn main() {\n    let mut total = 0;\n}"],
    ["yaml", "services:\n  api:\n    image: kemet/api"],
    ["css", ".card {\n  color: var(--text);\n}"],
  ])("devine %s", (language, text) => {
    expect(guessLanguage(text)).toBe(language);
  });

  it("répond texte sans indice", () => {
    expect(guessLanguage("alpha\nbeta\ngamma")).toBe("text");
  });

  it("reste linéaire sur le plus long texte analysé", () => {
    // Avant correction, l'indice CSS mettait 300 ms sur 55 ko et 1 s sur 110 ko.
    const start = performance.now();
    guessLanguage("key: value\n".repeat(700));
    guessLanguage("a{\nb:c\n".repeat(1100));
    guessLanguage("a{\n".repeat(2600));
    expect(performance.now() - start).toBeLessThan(100);
  });
});

describe("languageFromEditor", () => {
  it("lit le langage annoncé par VS Code", () => {
    expect(languageFromEditor('{"version":1,"mode":"python"}')).toBe("python");
    expect(languageFromEditor('{"mode":"typescriptreact"}')).toBe("tsx");
  });

  it("ignore un langage inconnu ou une donnée illisible", () => {
    expect(languageFromEditor('{"mode":"cobol"}')).toBeNull();
    expect(languageFromEditor("pas du json")).toBeNull();
    expect(languageFromEditor("")).toBeNull();
  });
});

describe("isInsideCodeFence", () => {
  it("détecte un bloc ouvert avant la position", () => {
    const value = "Texte\n```js\nconst x = 1;\n";
    expect(isInsideCodeFence(value, value.length)).toBe(true);
  });

  it("répond faux après un bloc refermé", () => {
    const value = "```js\nconst x = 1;\n```\n";
    expect(isInsideCodeFence(value, value.length)).toBe(false);
  });
});
