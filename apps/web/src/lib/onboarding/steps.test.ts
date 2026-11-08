import { describe, expect, it } from "vitest";
import { landingPath, nextStep, onboardingPath, previousStep, stepFromPath } from "./steps.js";

describe("étapes de l'onboarding", () => {
  it("relie chaque écran à son adresse, dans les deux sens", () => {
    expect(onboardingPath("country")).toBe("/bienvenue/pays");
    expect(stepFromPath("/bienvenue/specialite")).toBe("specialty");
    expect(stepFromPath("/bienvenue/personnes/")).toBe("people");
    expect(stepFromPath("/bienvenue/inconnu")).toBeNull();
    expect(stepFromPath("/bienvenue")).toBeNull();
  });

  it("enchaîne les six écrans dans l'ordre", () => {
    expect(nextStep("interests")).toBe("spaces");
    expect(nextStep("people")).toBeNull();
    expect(previousStep("role")).toBe("country");
    expect(previousStep("country")).toBeNull();
  });

  it("envoie à l'écran en cours tant que le parcours n'est pas terminé, au fil ensuite", () => {
    expect(landingPath("incomplete", null)).toBe("/completer-profil");
    expect(landingPath("ready", { step: "spaces", completed: false, interests: [], intents: [] })).toBe("/bienvenue/espaces");
    expect(landingPath("ready", { step: "spaces", completed: true, interests: [], intents: [] })).toBe("/fil");
  });
});
