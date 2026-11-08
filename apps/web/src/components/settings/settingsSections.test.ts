import { describe, expect, it } from "vitest";
import { filterSettingsSections, SETTINGS_SECTIONS } from "./settingsSections.js";

describe("filterSettingsSections", () => {
  it("trouve une section par un mot de son contenu, sans accent ni casse", () => {
    expect(filterSettingsSections(SETTINGS_SECTIONS, "THEME").map((section) => section.id)).toEqual(["apparence"]);
    expect(filterSettingsSections(SETTINGS_SECTIONS, "bloque").map((section) => section.id)).toEqual(["donnees"]);
    expect(filterSettingsSections(SETTINGS_SECTIONS, "mot de passe").map((section) => section.id)).toEqual(["compte"]);
  });

  it("garde toutes les sections sans recherche", () => {
    expect(filterSettingsSections(SETTINGS_SECTIONS, "  ")).toHaveLength(SETTINGS_SECTIONS.length);
  });

  it("n'a pas de section Notifications, que le code n'envoie pas", () => {
    expect(SETTINGS_SECTIONS.some((section) => section.id === "notifications")).toBe(false);
  });
});
