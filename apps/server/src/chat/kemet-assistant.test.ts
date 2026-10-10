import { describe, expect, it } from "vitest";
import { mentionsAssistant, parseAssistantRequest } from "./kemet-assistant.js";

describe("mentionsAssistant", () => {
  it("détecte une mention @kemet", () => {
    expect(mentionsAssistant("@kemet comment faire un webhook ?")).toBe(true);
  });

  it("ignore un message sans mention", () => {
    expect(mentionsAssistant("quelqu'un a déjà intégré Wave ?")).toBe(false);
  });

  it("ne confond pas @kemetien avec @kemet", () => {
    expect(mentionsAssistant("ping @kemetien")).toBe(false);
  });
});

describe("parseAssistantRequest", () => {
  it("extrait la question sans skill demandé", () => {
    expect(parseAssistantRequest("@kemet comment vérifier une signature de webhook ?")).toEqual({
      question: "comment vérifier une signature de webhook ?",
      requestedSlugs: [],
    });
  });

  it("extrait les skills demandés explicitement", () => {
    expect(parseAssistantRequest("@kemet avec wave-paiements, comment gérer un remboursement ?")).toEqual({
      question: "comment gérer un remboursement ?",
      requestedSlugs: ["wave-paiements"],
    });
  });

  it("extrait le skill demandé même sans virgule", () => {
    expect(parseAssistantRequest("@kemet avec ci-docker-fiable pourquoi ma CI est lente ?")).toEqual({
      question: "pourquoi ma CI est lente ?",
      requestedSlugs: ["ci-docker-fiable"],
    });
  });
});
