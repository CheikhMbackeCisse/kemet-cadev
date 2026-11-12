import { describe, expect, it } from "vitest";
import { atPlace, describeIdentity, profileSubtitle } from "./profileIdentity.js";

describe("describeIdentity", () => {
  it("précise le rôle par l'établissement, le mode de travail ou l'entreprise", () => {
    expect(describeIdentity({ role: "student", workMode: null, organization: "EPT" })).toBe(
      "Étudie l'informatique à l'EPT",
    );
    expect(describeIdentity({ role: "developer", workMode: "freelance", organization: null })).toBe(
      "Code en freelance",
    );
    expect(describeIdentity({ role: "developer", workMode: "employed", organization: "Kobo" })).toBe(
      "Code chez Kobo",
    );
    expect(describeIdentity({ role: "hr", workMode: null, organization: "Sahel Data" })).toBe(
      "Recrute chez Sahel Data",
    );
    expect(describeIdentity({ role: "entrepreneur", workMode: null, organization: "Baobab Pay" })).toBe(
      "Dirige Baobab Pay",
    );
  });

  it("garde le rôle seul, en verbe, sans précision, et rien pour Autre", () => {
    expect(describeIdentity({ role: "developer", workMode: "employed", organization: null })).toBe("Code");
    expect(describeIdentity({ role: "student", workMode: null, organization: null })).toBe(
      "Étudie l'informatique",
    );
    expect(describeIdentity({ role: "hr", workMode: null, organization: null })).toBe("Recrute");
    expect(describeIdentity({ role: "entrepreneur", workMode: null, organization: null })).toBe(
      "Dirige une entreprise",
    );
    expect(describeIdentity({ role: "other", workMode: null, organization: null })).toBeNull();
    expect(describeIdentity({ role: null, workMode: null, organization: null })).toBeNull();
  });

  it("n'écrit jamais un nom de métier accordé", () => {
    const roles = ["student", "developer", "designer", "hr", "project_manager", "entrepreneur"] as const;
    for (const role of roles) {
      for (const organization of [null, "Kobo"]) {
        const line = describeIdentity({ role, workMode: null, organization }) ?? "";
        expect(line).not.toMatch(/Étudiant|Développeu|Recrut(eur|euse)|Entrepreneu|Chef/);
      }
    }
  });

  it("ajoute la spécialité après l'identité", () => {
    expect(profileSubtitle({ role: "hr", workMode: null, organization: null, title: "Tech" })).toBe(
      "Recrute · Tech",
    );
    expect(profileSubtitle({ role: null, workMode: null, organization: null, title: null })).toBeNull();
  });
});

describe("atPlace", () => {
  it("accorde la préposition au nom saisi", () => {
    expect(atPlace("EPT")).toBe("à l'EPT");
    expect(atPlace("Université d'Ibadan")).toBe("à l'Université d'Ibadan");
    expect(atPlace("Le Cesti")).toBe("au Cesti");
    expect(atPlace("La Plateforme")).toBe("à la Plateforme");
    expect(atPlace("L'École 241")).toBe("à l'École 241");
    expect(atPlace("Sup'Info Dakar")).toBe("à Sup'Info Dakar");
  });
});
