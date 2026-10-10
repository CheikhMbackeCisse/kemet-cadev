import { createGeminiProvider } from "./gemini-provider.js";
import { createOpenRouterProvider } from "./openrouter-provider.js";
import { FallbackLlmProvider } from "./llm-provider.js";

export interface LlmProviderEnv {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

export function createLlmProviderFromEnv(env: LlmProviderEnv): FallbackLlmProvider {
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY manquante : l'assistant ne peut pas démarrer.");
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY manquante : l'assistant ne peut pas démarrer.");
  }
  return new FallbackLlmProvider(
    createGeminiProvider(env.GOOGLE_GENERATIVE_AI_API_KEY),
    createOpenRouterProvider(env.OPENROUTER_API_KEY),
  );
}
