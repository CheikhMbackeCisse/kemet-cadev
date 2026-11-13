import { describe, expect, it } from "vitest";
import { levelProgress } from "./progress.js";

describe("levelProgress", () => {
  it("compte les points qui manquent pour le niveau suivant", () => {
    expect(levelProgress(140)).toEqual({
      level: "apprenti",
      next: { level: "artisan", fromPoints: 0, minPoints: 300, remaining: 160, ratio: 140 / 300 },
    });
  });

  it("repart de zéro au seuil d'un niveau", () => {
    expect(levelProgress(1000).next).toMatchObject({
      level: "architecte",
      remaining: 1500,
      ratio: 0,
    });
  });

  it("n'annonce aucun niveau après Légende", () => {
    expect(levelProgress(7200)).toEqual({ level: "legende", next: null });
  });
});
