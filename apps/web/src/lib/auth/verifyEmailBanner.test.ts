import { describe, expect, it } from "vitest";
import {
  dismissVerifyEmailBanner,
  isVerifyEmailBannerDismissed,
  shouldShowVerifyEmailBanner,
} from "./verifyEmailBanner.js";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("rappel de confirmation de l'adresse email", () => {
  it("se montre tant que l'adresse n'est pas confirmée", () => {
    expect(shouldShowVerifyEmailBanner({ id: "u1", emailVerified: false }, false)).toBe(true);
  });

  it("disparaît une fois l'adresse confirmée", () => {
    expect(shouldShowVerifyEmailBanner({ id: "u1", emailVerified: true }, false)).toBe(false);
  });

  it("ne se montre pas à un visiteur", () => {
    expect(shouldShowVerifyEmailBanner(null, false)).toBe(false);
  });

  it("reste fermé pour ce compte seulement", () => {
    const storage = memoryStorage();
    dismissVerifyEmailBanner(storage, "u1");
    expect(isVerifyEmailBannerDismissed(storage, "u1")).toBe(true);
    expect(isVerifyEmailBannerDismissed(storage, "u2")).toBe(false);
  });

  it("supporte un stockage qui refuse l'accès", () => {
    const blocked = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("bloqué");
      },
    } as unknown as Storage;
    expect(() => dismissVerifyEmailBanner(blocked, "u1")).not.toThrow();
    expect(isVerifyEmailBannerDismissed(blocked, "u1")).toBe(false);
  });
});
