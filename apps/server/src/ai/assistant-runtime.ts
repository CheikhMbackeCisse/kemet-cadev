import { ConcurrencyLimiter, DEFAULT_MAX_CONCURRENT_ANSWERS } from "./concurrency-limiter.js";
import { databaseQuotaCounter, type QuotaCounter } from "./quota.js";

/**
 * Ressources partagées par toutes les réponses de @kemet d'une instance de
 * l'API : le compteur de quota et la file des rédactions en cours.
 */
export interface AssistantRuntime {
  quotaCounter: QuotaCounter;
  limiter: ConcurrencyLimiter;
}

/** Pour les tests : quota compté en base, file propre à l'instance. */
export function localAssistantRuntime(): AssistantRuntime {
  return {
    quotaCounter: databaseQuotaCounter,
    limiter: new ConcurrencyLimiter(DEFAULT_MAX_CONCURRENT_ANSWERS),
  };
}
