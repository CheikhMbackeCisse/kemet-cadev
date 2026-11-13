import { describe, expect, it } from "vitest";
import { SYSTALINK_HANDLE, isReservedHandle, updateProfileSchema } from "./profile.js";

describe("isReservedHandle", () => {
  it("réserve l'assistant, les profils anonymisés et Systalink", () => {
    expect(isReservedHandle("kocc")).toBe(true);
    expect(isReservedHandle("kemet")).toBe(true);
    expect(isReservedHandle("supprime-1234")).toBe(true);
    expect(isReservedHandle(SYSTALINK_HANDLE)).toBe(true);
  });

  it("laisse libres les identifiants voisins", () => {
    expect(isReservedHandle("systalink-fan")).toBe(false);
    expect(isReservedHandle("awa-ndiaye")).toBe(false);
  });

  it("refuse l'identifiant systalink dans un profil", () => {
    expect(updateProfileSchema.safeParse({ handle: "systalink" }).success).toBe(false);
  });
});
