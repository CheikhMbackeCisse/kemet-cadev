import { describe, expect, it } from "vitest";
import {
  deadlineLabel,
  formatFcfa,
  formatOfferDate,
  kindLabel,
  locationLabel,
  moneyLabel,
} from "./format.js";

const NARROW_SPACE = /[\u202f\u00a0]/g;

describe("format des offres", () => {
  it("sépare les milliers à la française", () => {
    expect(formatFcfa(3_000_000).replace(NARROW_SPACE, " ")).toBe("3 000 000");
  });

  it("lit une date sans décalage horaire", () => {
    expect(formatOfferDate("2026-12-01")).toBe("1 décembre 2026");
  });

  it("nomme le lieu, ou dit À distance", () => {
    expect(locationLabel({ remote: false, countryCode: "SN", city: "Thiès" })).toBe(
      "Thiès, Sénégal",
    );
    expect(locationLabel({ remote: true, countryCode: null, city: null })).toBe("À distance");
    expect(locationLabel({ remote: false, countryCode: "CI", city: null })).toBe("Côte d’Ivoire");
  });

  it("donne le budget d'une mission et la rémunération d'un emploi", () => {
    const mission = {
      kind: "mission" as const,
      compensationFcfa: null,
      budgetMinFcfa: 800_000,
      budgetMaxFcfa: 1_200_000,
    };
    expect(moneyLabel(mission)?.replace(NARROW_SPACE, " ")).toBe("Budget 800 000 à 1 200 000 FCFA");
    const job = {
      kind: "job" as const,
      compensationFcfa: 900_000,
      budgetMinFcfa: null,
      budgetMaxFcfa: null,
    };
    expect(moneyLabel(job)?.replace(NARROW_SPACE, " ")).toBe("900 000 FCFA par mois");
    expect(moneyLabel({ ...job, compensationFcfa: null })).toBeNull();
  });

  it("annonce la date limite, puis la clôture", () => {
    expect(deadlineLabel({ deadline: "2026-12-01", closed: false })).toBe(
      "Réponse avant le 1 décembre 2026",
    );
    expect(deadlineLabel({ deadline: "2026-11-01", closed: true })).toBe(
      "Clôturée le 1 novembre 2026",
    );
    expect(deadlineLabel({ deadline: null, closed: false })).toBeNull();
  });

  it("nomme le contrat d'un emploi", () => {
    expect(kindLabel({ kind: "job", contractType: "cdi" })).toBe("Emploi · CDI");
    expect(kindLabel({ kind: "job", contractType: "alternance" })).toBe("Emploi · Alternance");
    expect(kindLabel({ kind: "internship", contractType: "stage" })).toBe("Stage");
    expect(kindLabel({ kind: "mission", contractType: null })).toBe("Mission");
  });
});
