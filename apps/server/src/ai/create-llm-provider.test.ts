import { describe, expect, it } from "vitest";
import {
  DEFAULT_GEMINI_LITE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODELS,
  DEFAULT_OPENROUTER_DAILY_LIMIT,
  DEFAULT_OPENROUTER_MODELS,
  createLlmChainFromEnv,
  resolveLlmModels,
  resolveOpenRouterDailyLimit,
} from "./create-llm-provider.js";

const ALL_KEYS = { GOOGLE_GENERATIVE_AI_API_KEY: "g", GROQ_API_KEY: "q", OPENROUTER_API_KEY: "o" };

describe("resolveLlmModels", () => {
  it("prend les valeurs par défaut quand rien n'est configuré", () => {
    expect(resolveLlmModels({})).toEqual({
      gemini: [DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_LITE_MODEL],
      groq: DEFAULT_GROQ_MODELS,
      openrouter: DEFAULT_OPENROUTER_MODELS,
    });
    expect(DEFAULT_GROQ_MODELS).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    expect(DEFAULT_OPENROUTER_MODELS).toEqual(["google/gemma-4-26b-a4b-it:free"]);
  });

  it("lit les listes dans l'ordre, espaces et entrées vides retirés", () => {
    expect(
      resolveLlmModels({
        GEMINI_MODEL: "gemini-3.5-flash",
        GROQ_MODELS: " a , b ,",
        OPENROUTER_MODELS: "x:free,y:free",
      }),
    ).toEqual({
      gemini: ["gemini-3.5-flash", DEFAULT_GEMINI_LITE_MODEL],
      groq: ["a", "b"],
      openrouter: ["x:free", "y:free"],
    });
  });

  it("accepte encore les anciens noms au singulier, eux aussi en liste", () => {
    const models = resolveLlmModels({ GROQ_MODEL: "a,b", OPENROUTER_MODEL: "x:free" });
    expect(models.groq).toEqual(["a", "b"]);
    expect(models.openrouter).toEqual(["x:free"]);
  });

  it("préfère le nom au pluriel quand les deux sont remplis", () => {
    expect(resolveLlmModels({ GROQ_MODELS: "neuf", GROQ_MODEL: "ancien" }).groq).toEqual(["neuf"]);
  });

  it("traite une variable vide comme absente", () => {
    expect(
      resolveLlmModels({ GEMINI_MODEL: "", GROQ_MODELS: "  ", OPENROUTER_MODELS: "" }),
    ).toEqual(resolveLlmModels({}));
  });

  it("n'ajoute pas deux fois le même modèle Gemini", () => {
    expect(resolveLlmModels({ GEMINI_MODEL: "lite", GEMINI_LITE_MODEL: "lite" }).gemini).toEqual([
      "lite",
    ]);
  });
});

describe("createLlmChainFromEnv", () => {
  it("met Gemini, puis Gemini Lite, puis Groq, puis OpenRouter", () => {
    const chain = createLlmChainFromEnv({
      ...ALL_KEYS,
      GEMINI_MODEL: "gemini-3.5-flash",
      OPENROUTER_MODELS: "x:free,y:free",
    });
    expect(chain?.describe()).toEqual([
      { provider: "gemini", model: "gemini-3.5-flash" },
      { provider: "gemini", model: DEFAULT_GEMINI_LITE_MODEL },
      { provider: "groq", model: "openai/gpt-oss-120b" },
      { provider: "groq", model: "openai/gpt-oss-20b" },
      { provider: "openrouter", model: "x:free" },
      { provider: "openrouter", model: "y:free" },
    ]);
  });

  it("retire sans erreur le fournisseur dont la clé manque", () => {
    const chain = createLlmChainFromEnv({
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    });
    expect(chain?.describe().map((link) => link.provider)).toEqual([
      "gemini",
      "gemini",
      "openrouter",
    ]);
  });

  it("tourne avec une seule clé", () => {
    expect(
      createLlmChainFromEnv({ GROQ_API_KEY: "q" })
        ?.describe()
        .map((link) => link.provider),
    ).toEqual(["groq", "groq"]);
  });

  it("renvoie null sans aucune clé, ou avec des clés vides", () => {
    expect(createLlmChainFromEnv({})).toBeNull();
    expect(
      createLlmChainFromEnv({ GOOGLE_GENERATIVE_AI_API_KEY: " ", GROQ_API_KEY: "" }),
    ).toBeNull();
  });

  it("ne garde qu'un fournisseur quand une eval le demande", () => {
    expect(
      createLlmChainFromEnv(ALL_KEYS, { only: "groq" })
        ?.describe()
        .map((link) => link.provider),
    ).toEqual(["groq", "groq"]);
    expect(createLlmChainFromEnv({ GROQ_API_KEY: "q" }, { only: "openrouter" })).toBeNull();
  });
});

describe("resolveOpenRouterDailyLimit", () => {
  it("vaut 45 par défaut, sous les 50 requêtes gratuites du jour", () => {
    expect(resolveOpenRouterDailyLimit({})).toBe(DEFAULT_OPENROUTER_DAILY_LIMIT);
    expect(DEFAULT_OPENROUTER_DAILY_LIMIT).toBe(45);
  });

  it("lit la variable, et refuse une valeur qui n'est pas un entier positif", () => {
    expect(resolveOpenRouterDailyLimit({ OPENROUTER_DAILY_LIMIT: "10" })).toBe(10);
    expect(() => resolveOpenRouterDailyLimit({ OPENROUTER_DAILY_LIMIT: "beaucoup" })).toThrow(
      "OPENROUTER_DAILY_LIMIT",
    );
  });
});
