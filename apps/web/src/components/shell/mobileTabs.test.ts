import { describe, expect, it } from "vitest";
import { MOBILE_TABS, MOI_SHEET_ITEMS, mobileTabFor, mobileTabHref } from "./mobileTabs.js";
import { RAIL_NAV } from "./railNav.js";

describe("navigation mobile", () => {
  it("garde cinq onglets : Fil, Salons, Travaux, Skills, Moi", () => {
    expect(MOBILE_TABS.map((tab) => tab.id)).toEqual(["fil", "salons", "travaux", "skills", "moi"]);
  });

  it("place Travaux juste après le Fil sur bureau", () => {
    expect(RAIL_NAV.map((item) => item.id).slice(0, 2)).toEqual(["fil", "travaux"]);
  });

  it("range Projets, Compétitions, Paramètres et Confidentialité dans la feuille de Moi, jamais Kemet Pro", () => {
    const ids = MOI_SHEET_ITEMS.map((item) => item.id);
    expect(ids).toEqual(["projets", "competitions", "parametres", "confidentialite"]);
    expect(MOI_SHEET_ITEMS.some((item) => item.href === "/pro")).toBe(false);
  });

  it("couvre sur mobile chaque section du rail de bureau", () => {
    const reachable = new Set([...MOBILE_TABS, ...MOI_SHEET_ITEMS].map((item) => item.id));
    for (const section of RAIL_NAV) expect(reachable.has(section.id)).toBe(true);
  });

  it("allume Moi pour une section rangée dans sa feuille", () => {
    expect(mobileTabFor("competitions")).toBe("moi");
    expect(mobileTabFor("projets")).toBe("moi");
    expect(mobileTabFor("travaux")).toBe("travaux");
    expect(mobileTabFor("confidentialite")).toBe("moi");
    expect(mobileTabFor("skills")).toBe("skills");
    expect(mobileTabHref("skills")).toBe("/skills");
  });
});
