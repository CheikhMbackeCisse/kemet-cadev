import { describe, expect, it } from "vitest";
import { createWorkSchema } from "./work.js";

const VALID = {
  title: "Diagnostic des maladies du manioc",
  type: "thesis_research",
  summary: "Un modèle de vision qui tourne sur un téléphone d'entrée de gamme.",
  slug: "diagnostic-manioc",
  publishRightConfirmed: true,
};

describe("createWorkSchema", () => {
  it("accepte un identifiant ordinaire", () => {
    expect(createWorkSchema.safeParse(VALID).success).toBe(true);
  });

  it("refuse les identifiants pris par des pages sous /travaux/", () => {
    for (const slug of ["nouveau", "filtres"])
      expect(createWorkSchema.safeParse({ ...VALID, slug }).success).toBe(false);
  });
});
