import { opportunityInputSchema } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { buildOfferInput, EMPTY_OFFER_DRAFT, parseAmount, type OfferDraft } from "./offerForm.js";

const job: OfferDraft = {
  ...EMPTY_OFFER_DRAFT,
  kind: "job",
  title: "Développeuse ou développeur backend",
  organization: "Baobab Logistique",
  countryCode: "SN",
  city: "Dakar",
  domains: ["backend"],
  description: "Reprendre notre API de suivi de livraisons et ses tests.",
  contractType: "cdi",
  startDate: "2026-12-01",
  compensation: "900 000",
};

const mission: OfferDraft = {
  ...EMPTY_OFFER_DRAFT,
  kind: "mission",
  title: "ERP pour une PME de distribution",
  organization: "Distribution Ndiaye et Fils",
  countryCode: "SN",
  city: "Thiès",
  domains: ["web", "data"],
  description: "Stocks, ventes et facturation pour trois dépôts, avec un accès sur téléphone.",
  budgetMin: "3 000 000",
  budgetMax: "6000000",
  deadline: "2026-11-30",
  criteria: "- Une référence d'ERP livrée\n\n- Disponible à Thiès",
  contractType: "cdi",
  startDate: "2026-12-01",
  compensation: "1",
};

describe("formulaire d'offre", () => {
  it("lit un montant écrit avec des espaces", () => {
    expect(parseAmount("1 500 000")).toBe(1_500_000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12k")).toBeNaN();
  });

  it("construit un emploi que le serveur accepte", () => {
    const { input, errors } = buildOfferInput(job);
    expect(errors).toEqual({});
    expect(opportunityInputSchema.safeParse(input).success).toBe(true);
    expect(input?.compensationFcfa).toBe(900_000);
  });

  it("vide les champs d'emploi d'une mission et lit ses critères ligne par ligne", () => {
    const { input } = buildOfferInput(mission);
    expect(opportunityInputSchema.safeParse(input).success).toBe(true);
    expect(input).toMatchObject({ contractType: null, startDate: null, compensationFcfa: null });
    expect(input?.criteria).toEqual(["Une référence d'ERP livrée", "Disponible à Thiès"]);
  });

  it("donne un stage en contrat de stage", () => {
    const { input } = buildOfferInput({ ...job, kind: "internship", contractType: "" });
    expect(input?.contractType).toBe("stage");
  });

  it("dit ce qui manque, champ par champ", () => {
    const { input, errors } = buildOfferInput({ ...mission, budgetMin: "9 000 000", deadline: "", criteria: "" });
    expect(input).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["budgetMax", "criteria", "deadline"]);
    expect(buildOfferInput({ ...job, countryCode: "" }).errors.countryCode).toBeDefined();
    expect(buildOfferInput({ ...job, countryCode: "", remote: true }).errors.countryCode).toBeUndefined();
  });
});
