import { describe, expect, it } from "vitest";
import { competitionOfficialScore, credentialPoints } from "./points-rules.js";

const verifiedAt = new Date("2026-10-30T00:00:00Z");

describe("credentialPoints", () => {
  it("compte 100 points par année complète d'un poste, jusqu'à la vérification", () => {
    expect(credentialPoints({ type: "job", title: "Développeuse", startDate: "2023-11-01", endDate: null }, verifiedAt)).toBe(200);
    expect(credentialPoints({ type: "job", title: "Développeuse", startDate: "2023-10-29", endDate: null }, verifiedAt)).toBe(300);
  });

  it("s'arrête à la fin d'un poste terminé", () => {
    expect(credentialPoints({ type: "job", title: "Développeur", startDate: "2015-09-01", endDate: "2018-09-01" }, verifiedAt)).toBe(300);
  });

  it("ajoute 300 points pour un poste senior ou lead, lu dans l'intitulé", () => {
    expect(credentialPoints({ type: "job", title: "Lead backend", startDate: "2026-01-01", endDate: null }, verifiedAt)).toBe(300);
    expect(credentialPoints({ type: "job", title: "Développeur senior", startDate: "2026-01-01", endDate: null }, verifiedAt)).toBe(300);
    expect(credentialPoints({ type: "job", title: "Leader de communauté", startDate: "2026-01-01", endDate: null }, verifiedAt)).toBe(0);
  });

  it("distingue un diplôme obtenu d'une formation en cours", () => {
    expect(credentialPoints({ type: "education", title: "Master", startDate: "2019-09-01", endDate: "2021-06-01" }, verifiedAt)).toBe(150);
    expect(credentialPoints({ type: "education", title: "Master", startDate: "2025-09-01", endDate: "2027-06-01" }, verifiedAt)).toBe(20);
    expect(credentialPoints({ type: "education", title: "Certification", startDate: "2026-05-01", endDate: null }, verifiedAt)).toBe(20);
  });

  it("donne 30 points à un stage, quelle que soit sa durée", () => {
    expect(credentialPoints({ type: "internship", title: "Stage", startDate: "2019-02-01", endDate: "2019-08-01" }, verifiedAt)).toBe(30);
  });
});

describe("competitionOfficialScore", () => {
  it("pondère le jury à 70 % et le vote à 30 % sur 100", () => {
    expect(competitionOfficialScore(20, 10, 10)).toBe(100);
    expect(competitionOfficialScore(null, 0, 0)).toBe(0);
    expect(competitionOfficialScore(10, 1, 2)).toBeCloseTo(50);
  });
});
