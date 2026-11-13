import { MAX_SKILL_CONTENT_LENGTH } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { decodeSkillFile, MAX_SKILL_FILE_BYTES, parseSkillMarkdown } from "./skillFile.js";

const encode = (text: string) => new TextEncoder().encode(text);

describe("parseSkillMarkdown", () => {
  it("lit name et description de l'en-tête et garde le reste comme contenu", () => {
    const parsed = parseSkillMarkdown(
      '---\nname: "wave-paiements"\ndescription: Intégrer Wave côté serveur\nlicense: MIT\n---\n\n# Étapes\n\nVérifier la signature.\n',
    );
    expect(parsed).toEqual({
      name: "wave-paiements",
      description: "Intégrer Wave côté serveur",
      content: "# Étapes\n\nVérifier la signature.",
    });
  });

  it("accepte un fichier sans en-tête, avec BOM et fins de ligne Windows", () => {
    expect(parseSkillMarkdown("﻿# Titre\r\nTexte")).toEqual({
      name: null,
      description: null,
      content: "# Titre\r\nTexte",
    });
    expect(parseSkillMarkdown("---\r\nname: x\r\n---\r\nCorps").content).toBe("Corps");
  });

  it("ne prend pas une règle horizontale au milieu du texte pour un en-tête", () => {
    const parsed = parseSkillMarkdown("Intro\n---\nname: piège\n---\nSuite");
    expect(parsed.name).toBeNull();
    expect(parsed.content).toContain("name: piège");
  });
});

describe("decodeSkillFile", () => {
  it("refuse un fichier trop lourd, binaire ou vide", () => {
    expect(decodeSkillFile(new Uint8Array(MAX_SKILL_FILE_BYTES + 1))).toBe("tooLarge");
    expect(decodeSkillFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff]))).toBe(
      "notText",
    );
    expect(decodeSkillFile(encode("texte\u0000caché"))).toBe("notText");
    expect(decodeSkillFile(encode("---\nname: vide\n---\n   "))).toBe("empty");
  });

  it("refuse un contenu plus long que ce qu'un skill accepte", () => {
    expect(decodeSkillFile(encode("a".repeat(MAX_SKILL_CONTENT_LENGTH + 1)))).toBe(
      "contentTooLong",
    );
  });

  it("rend le contenu d'un vrai SKILL.md", () => {
    expect(decodeSkillFile(encode("---\nname: k\n---\nCorps"))).toMatchObject({
      name: "k",
      content: "Corps",
    });
  });
});
