import { createGeminiProvider } from "./gemini-provider.js";
import { createOpenRouterProvider } from "./openrouter-provider.js";
import { FallbackLlmProvider } from "./llm-provider.js";

// Alias tenu à jour par Google : survit à l'arrêt d'une version précise,
// comme celui de gemini-2.0-flash le 1er juin 2026.
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
export const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export interface LlmProviderEnv {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GEMINI_MODEL?: string;
  OPENROUTER_MODEL?: string;
}

export interface LlmModels {
  gemini: string;
  openrouter: string;
}

// Une variable vide vaut une variable absente : docker-compose transmet
// `${GEMINI_MODEL}` comme chaîne vide quand elle n'est pas définie.
export function resolveLlmModels(env: LlmProviderEnv): LlmModels {
  return {
    gemini: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    openrouter: env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
  };
}

export function createLlmProviderFromEnv(env: LlmProviderEnv): FallbackLlmProvider {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY manquante : l'assistant ne peut pas démarrer.");
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY manquante : l'assistant ne peut pas démarrer.");
  }
  const models = resolveLlmModels(env);
  return new FallbackLlmProvider(
    createGeminiProvider(env.GOOGLE_GENERATIVE_AI_API_KEY, models.gemini),
    createOpenRouterProvider(env.OPENROUTER_API_KEY, models.openrouter),
  );
}
