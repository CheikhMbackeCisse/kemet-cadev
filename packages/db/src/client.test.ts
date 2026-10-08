import { describe, expect, it } from "vitest";
import { createDb } from "./client.js";

describe("createDb", () => {
  it("construit un client sans ouvrir de connexion au chargement", () => {
    expect(() => createDb("postgres://kemet:kemet@localhost:5432/kemet")).not.toThrow();
  });
});
