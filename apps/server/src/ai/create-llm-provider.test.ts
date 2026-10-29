import { describe, expect, it } from "vitest";
import { FallbackLlmProvider } from "./llm-provider.js";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  createLlmProviderFromEnv,
  resolveLlmModels,
} from "./create-llm-provider.js";

describe("resolveLlmModels", () => {
  it("prend les modèles par défaut quand rien n'est configuré", () => {
    expect(resolveLlmModels({})).toEqual({
      gemini: DEFAULT_GEMINI_MODEL,
      openrouter: DEFAULT_OPENROUTER_MODEL,
    });
  });

  it("n'utilise plus gemini-2.0-flash, arrêté par Google le 1er juin 2026", () => {
    expect(DEFAULT_GEMINI_MODEL).toBe("gemini-flash-latest");
  });

  it("respecte les modèles configurés", () => {
    expect(
      resolveLlmModels({
        GEMINI_MODEL: "gemini-2.5-flash",
        OPENROUTER_MODEL: "mistralai/mistral-7b:free",
      }),
    ).toEqual({
      gemini: "gemini-2.5-flash",
      openrouter: "mistralai/mistral-7b:free",
    });
  });

  it("traite une variable vide comme absente", () => {
    expect(resolveLlmModels({ GEMINI_MODEL: "", OPENROUTER_MODEL: "  " })).toEqual({
      gemini: DEFAULT_GEMINI_MODEL,
      openrouter: DEFAULT_OPENROUTER_MODEL,
    });
  });
});

describe("createLlmProviderFromEnv", () => {
  it("refuse de démarrer sans clé Gemini", () => {
    expect(() => createLlmProviderFromEnv({ OPENROUTER_API_KEY: "cle" })).toThrow(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    );
  });

  it("refuse de démarrer sans clé OpenRouter", () => {
    expect(() => createLlmProviderFromEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "cle" })).toThrow(
      "OPENROUTER_API_KEY",
    );
  });

  it("construit les deux fournisseurs sans appel réseau", () => {
    const provider = createLlmProviderFromEnv({
      GOOGLE_GENERATIVE_AI_API_KEY: "cle",
      OPENROUTER_API_KEY: "cle",
      GEMINI_MODEL: "gemini-2.5-flash",
    });
    expect(provider).toBeInstanceOf(FallbackLlmProvider);
  });
});
