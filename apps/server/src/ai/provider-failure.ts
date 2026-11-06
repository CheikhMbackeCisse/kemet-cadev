import { LlmProviderError, type LlmFailureCause, type LlmProviderName } from "./llm-provider.js";

// Un délai annoncé est plafonné : une valeur aberrante ne doit pas écarter un
// modèle pour la journée. Seule la remise à zéro du quota du jour
// d'OpenRouter justifie d'attendre plus d'une heure.
const MAX_RETRY_AFTER_MS = 60 * 60 * 1000;
const MAX_DAILY_RESET_MS = 24 * 60 * 60 * 1000;

export interface HttpFailure {
  status: number;
  headers: Headers;
  /** Corps de la réponse d'erreur, jamais celui de la requête. */
  body: string;
}

/**
 * Traduit une réponse HTTP en échec : décide la cause, et lit combien de
 * temps le fournisseur demande d'attendre avant de le rappeler.
 */
export function toProviderError(provider: LlmProviderName, failure: HttpFailure): LlmProviderError {
  const cause = classifyHttpFailure(failure);
  // Un prompt trop long sera refusé de nouveau, mais un prompt plus court
  // passerait : Groq joint un retry-after à ce refus, qu'on n'applique pas
  // pour ne pas mettre le modèle en pause pour toutes les autres demandes.
  const retryAfterMs = cause === "rate_limited" ? readRetryAfterMs(provider, failure) : undefined;
  return new LlmProviderError(provider, cause, `HTTP ${failure.status}`, retryAfterMs);
}

export function classifyHttpFailure({ status, body }: HttpFailure): LlmFailureCause {
  // Groq refuse en 413 une requête qui dépasse à elle seule la limite de
  // tokens par minute, et d'autres fournisseurs répondent 400
  // "context_length_exceeded" quand le prompt dépasse la fenêtre du modèle :
  // dans les deux cas, inutile d'insister avec ce prompt. Un 429 qui parle
  // de tokens par minute, lui, signale un quota épuisé pour quelques
  // secondes : il reste un `rate_limited`, avec sa pause.
  if (status === 413 || (status === 400 && /context_length_exceeded/i.test(body))) {
    return "prompt_too_large";
  }
  if (status === 429) return "rate_limited";
  if (status === 402) return "payment_required";
  if (status === 404) return "model_unavailable";
  if (status >= 500) return "server_error";
  return "rejected";
}

/**
 * Trois façons de dire "rappelle-moi plus tard" : l'en-tête standard
 * retry-after (secondes ou date), le `RetryInfo.retryDelay` que Gemini met
 * dans le corps ("38s"), et `X-RateLimit-Reset` d'OpenRouter, une date en
 * millisecondes, quand son quota gratuit du jour est épuisé.
 */
export function readRetryAfterMs(
  provider: LlmProviderName,
  { headers, body }: HttpFailure,
  now = Date.now(),
): number | undefined {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return clamp(seconds * 1000, MAX_RETRY_AFTER_MS);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return clamp(date - now, MAX_RETRY_AFTER_MS);
  }

  if (provider === "gemini") {
    const geminiDelay = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
    if (geminiDelay) return clamp(Number(geminiDelay[1]) * 1000, MAX_RETRY_AFTER_MS);
  }

  if (provider === "openrouter") {
    const reset = Number(headers.get("x-ratelimit-reset"));
    // Les secondes depuis 1970 tiennent sur 10 chiffres, les millisecondes
    // sur 13 : en dessous, ce ne serait pas une date en millisecondes.
    if (Number.isFinite(reset) && reset > 1e12) return clamp(reset - now, MAX_DAILY_RESET_MS);
  }
  return undefined;
}

function clamp(ms: number, max: number): number | undefined {
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.min(ms, max);
}
