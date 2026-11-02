import { describe, expect, it } from "vitest";
import { missingFieldsReason } from "./forms.js";

describe("missingFieldsReason", () => {
  it("liste les champs obligatoires vides, sans leur précision entre parenthèses", () => {
    expect(
      missingFieldsReason([
        ["wave", "Nom"],
        ["  ", "Identifiant"],
        [null, "Description (une phrase : quand l'utiliser)"],
      ]),
    ).toBe("À remplir : Identifiant, Description.");
  });

  it("ne donne aucune raison quand tout est rempli", () => {
    expect(missingFieldsReason([["wave", "Nom"]])).toBeNull();
  });
});
