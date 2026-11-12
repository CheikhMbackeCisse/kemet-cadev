import { describe, expect, it } from "vitest";
import { describeIdentity, profileSubtitle } from "./profileIdentity.js";

describe("describeIdentity", () => {
  it("précise le rôle par l'établissement, le mode de travail ou l'entreprise", () => {
    expect(describeIdentity({ role: "student", workMode: null, organization: "EPT" })).toBe(
      "Étudiant en informatique · EPT",
    );
    expect(describeIdentity({ role: "developer", workMode: "freelance", organization: null })).toBe(
      "Développeur freelance",
    );
    expect(describeIdentity({ role: "developer", workMode: "employed", organization: "Kobo" })).toBe(
      "Développeur chez Kobo",
    );
    expect(describeIdentity({ role: "hr", workMode: null, organization: "Sahel Data" })).toBe(
      "Recruteur chez Sahel Data",
    );
  });

  it("garde le rôle seul sans précision, et rien pour Autre", () => {
    expect(describeIdentity({ role: "developer", workMode: "employed", organization: null })).toBe(
      "Développeur",
    );
    expect(describeIdentity({ role: "student", workMode: null, organization: null })).toBe(
      "Étudiant en informatique",
    );
    expect(describeIdentity({ role: "other", workMode: null, organization: null })).toBeNull();
    expect(describeIdentity({ role: null, workMode: null, organization: null })).toBeNull();
  });

  it("ajoute la spécialité après l'identité", () => {
    expect(
      profileSubtitle({ role: "hr", workMode: null, organization: null, title: "Tech" }),
    ).toBe("Recruteur · Tech");
    expect(
      profileSubtitle({ role: null, workMode: null, organization: null, title: null }),
    ).toBeNull();
  });
});
