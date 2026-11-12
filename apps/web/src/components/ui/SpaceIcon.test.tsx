import { describe, expect, it } from "vitest";
import { Braces, Briefcase, Cloud, Database, Flag, Gamepad2, Lock, Sprout, Trophy } from "lucide-react";
import { spaceTechLogo, spaceThemeIcon, spaceTints } from "./SpaceIcon.js";

describe("spaceThemeIcon", () => {
  it("donne à chaque espace du seed l'icône de son sujet", () => {
    expect(spaceThemeIcon("Data & Intelligence Artificielle")).toBe(Database);
    expect(spaceThemeIcon("Backend & API")).toBe(Braces);
    expect(spaceThemeIcon("DevOps & Cloud Afrique")).toBe(Cloud);
    expect(spaceThemeIcon("Cybersécurité")).toBe(Lock);
    expect(spaceThemeIcon("Jeux Vidéo Afrique")).toBe(Gamepad2);
    expect(spaceThemeIcon("Carrière & Freelance Tech")).toBe(Briefcase);
    expect(spaceThemeIcon("Débuter en informatique")).toBe(Sprout);
    expect(spaceThemeIcon("Hackathons et concours")).toBe(Trophy);
    expect(spaceThemeIcon("CADEV 2026")).toBe(Flag);
  });

  it("garde le logo d'une technologie précise", () => {
    expect(spaceTechLogo("Flutter Afrique")).toBe("flutter");
  });
});

describe("spaceTints", () => {
  it("donne des teintes différentes à deux espaces de même icône", () => {
    const tints = spaceTints([
      { id: "a", name: "DevOps Dakar" },
      { id: "b", name: "Cloud et infra" },
      { id: "c", name: "Design produit" },
      { id: "d", name: "UX Afrique" },
    ]);
    expect(tints.get("a")).not.toBe(tints.get("b"));
    expect(tints.get("c")).not.toBe(tints.get("d"));
  });

  it("garde des teintes entre 1 et 6 et la même pour une même liste", () => {
    const spaces = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      name: `Backend ${index}`,
    }));
    const first = spaceTints(spaces);
    const second = spaceTints(spaces);
    for (const space of spaces) {
      const tint = first.get(space.id);
      expect(tint).toBeGreaterThanOrEqual(1);
      expect(tint).toBeLessThanOrEqual(6);
      expect(second.get(space.id)).toBe(tint);
    }
    expect(new Set(spaces.slice(0, 6).map((space) => first.get(space.id))).size).toBe(6);
  });
});
