import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearIntroAnswers,
  hasSeenIntro,
  markIntroSeen,
  readIntroAnswers,
  saveIntroAnswers,
} from "./introStorage.js";

describe("introStorage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("garde les réponses et le passage par l'accueil", () => {
    expect(hasSeenIntro()).toBe(false);
    saveIntroAnswers({ role: "developer", interests: ["web"], intents: ["learn"], country: "SN" });
    markIntroSeen();

    expect(hasSeenIntro()).toBe(true);
    expect(readIntroAnswers()).toEqual({ role: "developer", interests: ["web"], intents: ["learn"], country: "SN" });
  });

  it("oublie les valeurs inconnues lues dans le navigateur", () => {
    window.localStorage.setItem(
      "kemet.intro",
      JSON.stringify({ seen: true, answers: { role: "admin", country: "XX", interests: ["web", "cuisine"], intents: 3 } }),
    );

    expect(readIntroAnswers()).toEqual({ interests: ["web"], intents: undefined });
  });

  it("efface les réponses en gardant l'accueil comme vu", () => {
    saveIntroAnswers({ role: "hr" });
    clearIntroAnswers();

    expect(readIntroAnswers()).toEqual({ interests: undefined, intents: undefined });
    expect(hasSeenIntro()).toBe(true);
  });

  it("ne casse rien quand le stockage est bloqué", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqué");
    });

    expect(() => markIntroSeen()).not.toThrow();
    expect(hasSeenIntro()).toBe(false);
  });
});
