import { describe, expect, it } from "vitest";
import { demoUuid } from "./demo-uuid.js";

describe("demoUuid", () => {
  it("donne toujours le même identifiant pour le même nom", () => {
    expect(demoUuid("post:baobab")).toBe(demoUuid("post:baobab"));
  });

  it("donne des identifiants différents pour des noms différents", () => {
    expect(demoUuid("post:baobab")).not.toBe(demoUuid("post:boutique"));
  });

  it("produit un UUID de version 5 bien formé", () => {
    expect(demoUuid("post:baobab")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
