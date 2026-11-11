import { describe, expect, it } from "vitest";
import { mentionsAssistant, parseAssistantRequest } from "./kemet-assistant.js";

describe("mentionsAssistant", () => {
  it("détecte une mention @kocc", () => {
    expect(mentionsAssistant("@kocc comment faire un webhook ?")).toBe(true);
  });

  it("comprend encore l'ancienne mention @kemet", () => {
    expect(mentionsAssistant("@kemet comment faire un webhook ?")).toBe(true);
    expect(mentionsAssistant("Merci @Kemet.")).toBe(true);
  });

  it("ignore un message sans mention", () => {
    expect(mentionsAssistant("quelqu'un a déjà intégré Wave ?")).toBe(false);
  });

  it("ne confond pas un identifiant plus long avec l'assistant", () => {
    expect(mentionsAssistant("ping @kemetien")).toBe(false);
    expect(mentionsAssistant("ping @kocc-fan")).toBe(false);
  });
});

describe("parseAssistantRequest", () => {
  it("extrait la question sans skill demandé", () => {
    expect(parseAssistantRequest("@kocc comment vérifier une signature de webhook ?")).toEqual({
      question: "comment vérifier une signature de webhook ?",
      requestedSlugs: [],
    });
  });

  it("extrait les skills demandés explicitement", () => {
    expect(parseAssistantRequest("@kocc avec wave-paiements, comment gérer un remboursement ?")).toEqual({
      question: "comment gérer un remboursement ?",
      requestedSlugs: ["wave-paiements"],
    });
  });

  it("extrait le skill demandé avec l'ancienne mention, même sans virgule", () => {
    expect(parseAssistantRequest("@kemet avec ci-docker-fiable pourquoi ma CI est lente ?")).toEqual({
      question: "pourquoi ma CI est lente ?",
      requestedSlugs: ["ci-docker-fiable"],
    });
  });
});
