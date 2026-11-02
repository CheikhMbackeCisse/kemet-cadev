import { describe, expect, it } from "vitest";
import { loadPrivacyContact } from "./privacy-config.js";

describe("loadPrivacyContact", () => {
  it("renvoie le nom et l'adresse quand les deux sont définis", () => {
    expect(
      loadPrivacyContact({ PRIVACY_CONTACT_NAME: " Responsable ", PRIVACY_CONTACT_EMAIL: "contact@example.org" }),
    ).toEqual({ name: "Responsable", email: "contact@example.org" });
  });

  it("renvoie null si l'une des deux variables manque ou est vide", () => {
    expect(loadPrivacyContact({})).toBeNull();
    expect(loadPrivacyContact({ PRIVACY_CONTACT_NAME: "Responsable", PRIVACY_CONTACT_EMAIL: "" })).toBeNull();
    expect(loadPrivacyContact({ PRIVACY_CONTACT_NAME: " ", PRIVACY_CONTACT_EMAIL: "contact@example.org" })).toBeNull();
  });
});
