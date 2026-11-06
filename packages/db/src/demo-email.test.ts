import { describe, expect, it } from "vitest";
import { isDemoEmailAddress } from "./demo-email.js";

describe("isDemoEmailAddress", () => {
  it("reconnaît une adresse du domaine de démonstration, quelle que soit la casse", () => {
    expect(isDemoEmailAddress("coumba.thiam@demo.kemetlabs.dev")).toBe(true);
    expect(isDemoEmailAddress(" Coumba.Thiam@DEMO.kemetlabs.dev ")).toBe(true);
  });

  it("reconnaît un sous-domaine, un nom d'affichage et un point final", () => {
    expect(isDemoEmailAddress("coumba@x.demo.kemetlabs.dev")).toBe(true);
    expect(isDemoEmailAddress('"Coumba" <coumba@demo.kemetlabs.dev>')).toBe(true);
    expect(isDemoEmailAddress("coumba@demo.kemetlabs.dev.")).toBe(true);
  });

  it("ne prend pas un domaine voisin pour le domaine de démonstration", () => {
    expect(isDemoEmailAddress("coumba@kemetlabs.dev")).toBe(false);
    expect(isDemoEmailAddress("coumba@notdemo.kemetlabs.dev")).toBe(false);
    expect(isDemoEmailAddress("coumba@demo.kemetlabs.dev.example.com")).toBe(false);
  });
});
