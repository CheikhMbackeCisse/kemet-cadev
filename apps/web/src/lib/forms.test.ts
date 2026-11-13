import { describe, expect, it } from "vitest";
import { hasFieldErrors, requiredFieldErrors, validateFields } from "./forms.js";

describe("requiredFieldErrors", () => {
  it("signale chaque champ obligatoire vide ou fait d'espaces", () => {
    const errors = requiredFieldErrors({ name: "wave", slug: "  ", description: null });
    expect(Object.keys(errors)).toEqual(["slug", "description"]);
    expect(hasFieldErrors(errors)).toBe(true);
  });

  it("ne signale rien quand tout est rempli", () => {
    expect(hasFieldErrors(requiredFieldErrors({ name: "wave" }))).toBe(false);
  });
});

describe("validateFields", () => {
  it("demande une longueur minimale une fois le champ rempli", () => {
    expect(validateFields({ description: { value: "court", min: 10 } }).description).toBe(
      "Au moins 10 caractères.",
    );
    expect(validateFields({ description: { value: "", min: 10 } }).description).toBe(
      "Champ obligatoire.",
    );
  });
});
