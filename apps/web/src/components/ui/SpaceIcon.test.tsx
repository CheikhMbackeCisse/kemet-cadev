import { describe, expect, it } from "vitest";
import {
  AppWindow,
  Braces,
  Briefcase,
  Cloud,
  CodeXml,
  Database,
  Flag,
  Gamepad2,
  Lock,
  Sprout,
  Trophy,
} from "lucide-react";
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

  it("ne confond pas un mot qui contient le motif d'un autre sujet", () => {
    expect(spaceThemeIcon("Linux pour tous")).not.toBe(AppWindow);
    expect(spaceThemeIcon("Jeunes codeurs")).not.toBe(Gamepad2);
    expect(spaceThemeIcon("Développeurs de Lomé")).toBe(CodeXml);
    expect(spaceThemeIcon("UI et UX")).toBe(AppWindow);
  });

  it("garde le logo d'une technologie précise", () => {
    expect(spaceTechLogo("Flutter Afrique")).toBe("flutter");
  });
});

describe("spaceTints", () => {
  it("donne à chaque icône de thème sa propre teinte, la même partout", () => {
    const names = [
      "Débuter en informatique",
      "CADEV 2026",
      "Hackathons et concours",
      "Carrière & Freelance Tech",
      "Data & Intelligence Artificielle",
      "Backend & API",
      "DevOps & Cloud Afrique",
      "Cybersécurité",
      "Jeux Vidéo Afrique",
      "Frontend & Design Systems",
      "Startups et produit",
      "Développeurs de Lomé",
    ];
    const tints = spaceTints(names.map((name) => ({ id: name, name })));
    expect(new Set(names.map((name) => spaceThemeIcon(name))).size).toBe(12);
    expect(new Set(names.map((name) => tints.get(name))).size).toBe(12);
    const again = spaceTints([{ id: "x", name: "Cloud et infra" }]);
    expect(again.get("x")).toBe(tints.get("DevOps & Cloud Afrique"));
  });

  it("fait tourner les douze teintes sur les espaces sans thème", () => {
    const spaces = Array.from({ length: 14 }, (_, index) => ({
      id: String(index),
      name: `Discussions ${index}`,
    }));
    const tints = spaceTints(spaces);
    for (const space of spaces) {
      expect(tints.get(space.id)).toBeGreaterThanOrEqual(1);
      expect(tints.get(space.id)).toBeLessThanOrEqual(12);
    }
    expect(new Set(spaces.slice(0, 12).map((space) => tints.get(space.id))).size).toBe(12);
  });
});
