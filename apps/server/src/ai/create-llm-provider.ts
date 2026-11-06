import { MemoryDailyBudget, type DailyBudget } from "./daily-budget.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { LlmChain, type ChainLink, type FallbackLogger, type LinkTimeouts } from "./llm-chain.js";
import type { LlmProviderName } from "./llm-provider.js";
import {
  GROQ_BASE_URL,
  OPENROUTER_BASE_URL,
  createOpenAiCompatibleProvider,
} from "./openai-compatible-provider.js";

// Alias tenu à jour par Google : survit à l'arrêt d'une version précise,
// comme celui de gemini-2.0-flash le 1er juin 2026.
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
// Quota gratuit compté par modèle (GenerateRequestsPerMinutePerProjectPerModel,
// vérifié le 03/11/2026) : quand le modèle principal est à 429, la version
// Lite répond encore, avec son propre quota.
export const DEFAULT_GEMINI_LITE_MODEL = "gemini-flash-lite-latest";
// Quotas séparés par modèle chez Groq (1 000 requêtes par jour et 8 000
// tokens par minute chacun, lus dans les en-têtes le 03/11/2026) : le second
// modèle double la capacité.
export const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
export const DEFAULT_OPENROUTER_MODELS = ["google/gemma-4-26b-a4b-it:free"];
// L'offre gratuite d'OpenRouter s'arrête à 50 requêtes par jour, tous modèles
// gratuits confondus : la chaîne s'arrête avant, et garde une marge pour un
// test lancé à la main.
export const DEFAULT_OPENROUTER_DAILY_LIMIT = 45;
// Limite de tokens par minute de l'offre gratuite de Groq pour les modèles
// gpt-oss : une requête plus grosse est refusée d'emblée (413).
const GROQ_MAX_PROMPT_TOKENS = 8_000;

/**
 * Délais par fournisseur, fixés d'après les mesures du 03/11/2026 sur les
 * offres gratuites, avec une marge de deux à trois fois :
 * - gemini-3.5-flash : réponse courte en 4,6 à 6,4 s, dont une réflexion de
 *   près de 600 tokens. L'alias gemini-flash-latest n'avait toujours rien
 *   envoyé après 60 s : au-delà de 15 s, on n'attend plus.
 * - Gemini Lite : 1,2 à 1,8 s, sans réflexion.
 * - Groq : 0,4 à 5,3 s pour une phrase selon l'heure, 0,9 à 1,2 s pour un
 *   JSON strict.
 * - OpenRouter : les modèles gratuits passent par une file d'attente partagée,
 *   les plus lents de la chaîne ; c'est le dernier recours, on lui laisse plus.
 * Pire cas, quand tous se taisent : 15 + 8 + 10 par modèle Groq + 20 par
 * modèle OpenRouter, soit 63 s avec la configuration par défaut. En pratique un
 * quota épuisé répond 429 en moins de deux secondes, et le modèle est ensuite
 * sauté sans appel tant que dure sa pause.
 */
const TIMEOUTS: Record<"gemini" | "geminiLite" | "groq" | "openrouter", LinkTimeouts> = {
  gemini: { firstChunkMs: 15_000, jsonResponseMs: 30_000 },
  geminiLite: { firstChunkMs: 8_000, jsonResponseMs: 15_000 },
  groq: { firstChunkMs: 10_000, jsonResponseMs: 15_000 },
  openrouter: { firstChunkMs: 20_000, jsonResponseMs: 40_000 },
};

export interface LlmProviderEnv {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_LITE_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODELS?: string;
  /** Ancien nom, toujours lu quand GROQ_MODELS est vide. */
  GROQ_MODEL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODELS?: string;
  /** Ancien nom, toujours lu quand OPENROUTER_MODELS est vide. */
  OPENROUTER_MODEL?: string;
  OPENROUTER_DAILY_LIMIT?: string;
}

export interface LlmModels {
  gemini: string[];
  groq: string[];
  openrouter: string[];
}

// Une variable vide vaut une variable absente : docker-compose transmet
// `${GEMINI_MODEL}` comme chaîne vide quand elle n'est pas définie.
function readList(...values: (string | undefined)[]): string[] {
  for (const value of values) {
    const list = (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  return [];
}

export function resolveLlmModels(env: LlmProviderEnv): LlmModels {
  const gemini = readList(env.GEMINI_MODEL)[0] ?? DEFAULT_GEMINI_MODEL;
  const geminiLite = readList(env.GEMINI_LITE_MODEL)[0] ?? DEFAULT_GEMINI_LITE_MODEL;
  const groq = readList(env.GROQ_MODELS, env.GROQ_MODEL);
  const openrouter = readList(env.OPENROUTER_MODELS, env.OPENROUTER_MODEL);
  return {
    gemini: gemini === geminiLite ? [gemini] : [gemini, geminiLite],
    groq: groq.length > 0 ? groq : DEFAULT_GROQ_MODELS,
    openrouter: openrouter.length > 0 ? openrouter : DEFAULT_OPENROUTER_MODELS,
  };
}

export interface LlmChainOptions {
  /** Réservé aux evals : n'appeler qu'un fournisseur, pour juger chacun à part. */
  only?: LlmProviderName;
  logger?: FallbackLogger;
  /** Compteur des appels OpenRouter du jour ; en mémoire si absent. */
  openRouterBudget?: DailyBudget;
}

export function resolveOpenRouterDailyLimit(env: LlmProviderEnv): number {
  const value = Number(env.OPENROUTER_DAILY_LIMIT?.trim() || DEFAULT_OPENROUTER_DAILY_LIMIT);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("OPENROUTER_DAILY_LIMIT doit être un entier positif ou nul.");
  }
  return value;
}

/**
 * Construit la chaîne dans l'ordre : Gemini, Gemini Lite, Groq (modèles dans
 * l'ordre de GROQ_MODELS), OpenRouter (dans l'ordre de OPENROUTER_MODELS).
 * OpenRouter vient en dernier : son offre gratuite ne donne que 50 requêtes
 * par jour, tous modèles confondus. Une clé absente retire son fournisseur
 * sans erreur. `null` quand aucune clé n'est configurée.
 */
export function createLlmChainFromEnv(
  env: LlmProviderEnv,
  options: LlmChainOptions = {},
): LlmChain | null {
  const models = resolveLlmModels(env);
  const links: ChainLink[] = [];

  const geminiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (geminiKey) {
    models.gemini.forEach((model, index) =>
      links.push({
        provider: createGeminiProvider(geminiKey, model),
        timeouts: index === 0 ? TIMEOUTS.gemini : TIMEOUTS.geminiLite,
      }),
    );
  }

  const groqKey = env.GROQ_API_KEY?.trim();
  if (groqKey) {
    for (const model of models.groq) {
      links.push({
        provider: createOpenAiCompatibleProvider({
          name: "groq",
          baseUrl: GROQ_BASE_URL,
          apiKey: groqKey,
          model,
        }),
        timeouts: TIMEOUTS.groq,
        maxPromptTokens: GROQ_MAX_PROMPT_TOKENS,
      });
    }
  }

  const openRouterKey = env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    // Un seul compteur pour tous les modèles OpenRouter : le quota gratuit
    // est commun à tous.
    const budget =
      options.openRouterBudget ?? new MemoryDailyBudget(resolveOpenRouterDailyLimit(env));
    for (const model of models.openrouter) {
      links.push({
        provider: createOpenAiCompatibleProvider({
          name: "openrouter",
          baseUrl: OPENROUTER_BASE_URL,
          apiKey: openRouterKey,
          model,
        }),
        timeouts: TIMEOUTS.openrouter,
        budget,
      });
    }
  }

  const selected = options.only
    ? links.filter((link) => link.provider.name === options.only)
    : links;
  return selected.length > 0 ? new LlmChain(selected, options.logger) : null;
}
