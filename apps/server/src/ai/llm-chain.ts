import type { DailyBudget } from "./daily-budget.js";
import { parseJsonOutput } from "./json-output.js";
import {
  AllProvidersUnavailableError,
  LlmProviderError,
  type JsonOutputRequest,
  type LlmFailureCause,
  type LlmMessage,
  type LlmProvider,
  type LlmProviderName,
  type LlmRequestOptions,
  type LlmStreamChunk,
  type StreamingLlmProvider,
} from "./llm-provider.js";

/**
 * Délais propres à un maillon. Ils ne bornent que l'attente avant de pouvoir
 * passer au suivant : une fois qu'un morceau de réponse est affiché, on ne
 * change plus de modèle, sinon la personne verrait une réponse à moitié
 * écrite suivie d'une autre.
 */
export interface LinkTimeouts {
  /** Réponse en streaming (salon) : délai avant le premier morceau. */
  firstChunkMs: number;
  /** Réponse JSON (Travaux) : délai pour la réponse entière, rien n'étant affiché avant. */
  jsonResponseMs: number;
}

export interface ChainLink {
  provider: LlmProvider;
  timeouts: LinkTimeouts;
  /** Budget journalier partagé par les maillons d'un même fournisseur. */
  budget?: DailyBudget;
  /**
   * Taille de prompt au-delà de laquelle le maillon est sauté sans appel :
   * Groq refuse (413) toute requête plus grosse que sa limite de tokens par
   * minute, autant ne pas la lui envoyer.
   */
  maxPromptTokens?: number;
}

export type SkipReason = "daily_budget_reached" | "budget_unavailable" | "prompt_too_large";

/** Ce qu'on journalise d'une bascule : jamais le prompt, la réponse ni une clé. */
export interface FallbackLogEntry {
  event: "llm_fallback" | "llm_skipped" | "llm_failed_mid_stream" | "llm_chain_exhausted";
  provider?: LlmProviderName;
  model?: string;
  cause?: LlmFailureCause | SkipReason;
  pausedForMs?: number;
}

export type FallbackLogger = (entry: FallbackLogEntry) => void;

// Une réponse déjà commencée a droit à ce délai en tout : au-delà, elle est
// coupée plutôt que de laisser l'indicateur "@kemet écrit" tourner sans fin.
const STREAM_TOTAL_MS = 120_000;

// La réponse est enregistrée comme un message sans passer par la validation
// des messages : un fournisseur qui enverrait du texte sans fin ne doit pas
// remplir la base. Une réponse utile tient très largement dans cette taille.
export const MAX_RESPONSE_CHARS = 20_000;

// Le budget OpenRouter vit dans Valkey : s'il ne répond pas vite, on saute
// OpenRouter (son quota reste protégé) au lieu de bloquer la réponse.
const BUDGET_CHECK_MS = 1_000;

// Pause d'un modèle selon la cause de son échec, quand le fournisseur n'a pas
// dit combien attendre. Un 429 sans délai annoncé vient en général d'une
// limite par minute ; un modèle introuvable ou payant ne reviendra pas avant
// qu'on change la configuration, inutile de le rappeler à chaque question.
const DEFAULT_PAUSE_MS: Partial<Record<LlmFailureCause, number>> = {
  rate_limited: 20_000,
  model_unavailable: 10 * 60_000,
  payment_required: 10 * 60_000,
};

const defaultLogger: FallbackLogger = (entry) => console.warn(JSON.stringify(entry));

/**
 * Chaîne de secours : chaque question part chez le premier maillon (un
 * modèle chez un fournisseur), et passe au suivant si celui-ci ne répond
 * pas. On passe au suivant sur :
 * - 429 (quota par minute ou par jour) : le maillon est aussi mis en pause
 *   pendant le délai annoncé par le fournisseur, pour que les questions
 *   suivantes ne gaspillent pas un appel sur un quota qu'on sait épuisé ;
 * - 5xx, coupure réseau, modèle introuvable, clé refusée ;
 * - délai dépassé (`LinkTimeouts`) ;
 * - prompt refusé parce qu'il dépasse la limite de tokens du modèle : le
 *   maillon suivant a souvent une limite plus large ;
 * - réponse JSON qui ne passe pas la validation Zod, quand on en demande une.
 *
 * Quand tous les maillons ont échoué, `AllProvidersUnavailableError` : à
 * l'appelant d'afficher un message clair ou un repli sans l'assistant.
 */
export class LlmChain implements StreamingLlmProvider {
  private readonly pausedUntil = new Map<string, number>();

  constructor(
    private readonly links: ChainLink[],
    private readonly log: FallbackLogger = defaultLogger,
  ) {}

  /** Les maillons dans l'ordre d'appel, pour les journaux de démarrage et les evals. */
  describe(): { provider: LlmProviderName; model: string }[] {
    return this.links.map(({ provider }) => ({ provider: provider.name, model: provider.model }));
  }

  async *streamResponse(
    messages: LlmMessage[],
    options: LlmRequestOptions = {},
  ): AsyncGenerator<LlmStreamChunk> {
    for (const link of this.links) {
      const { name, model } = link.provider;
      if (this.isPaused(link)) continue;
      const skipReason = await this.skipReason(link, messages);
      if (skipReason) {
        this.log({ event: "llm_skipped", provider: name, model, cause: skipReason });
        continue;
      }

      if (options.json) {
        try {
          const text = await this.collectJson(link, messages, options.json);
          yield { provider: name, model, delta: text };
          return;
        } catch (error) {
          this.handleFailure(link, error);
          continue;
        }
      }

      let started = false;
      try {
        for await (const delta of this.stream(link, messages)) {
          started = true;
          yield { provider: name, model, delta };
        }
      } catch (error) {
        if (started && error instanceof LlmProviderError) {
          this.log({
            event: "llm_failed_mid_stream",
            provider: name,
            model,
            cause: error.failureCause,
          });
          throw error;
        }
        if (started) throw error;
        this.handleFailure(link, error);
        continue;
      }
      if (started) return;
      // Fin de flux sans aucun texte (réponse bloquée par un filtre, par
      // exemple) : traité comme un échec, le maillon suivant peut répondre.
      this.handleFailure(link, new LlmProviderError(name, "server_error", "réponse vide"));
    }

    this.log({ event: "llm_chain_exhausted" });
    throw new AllProvidersUnavailableError();
  }

  // Vérifié juste avant l'appel, et dans cet ordre : un prompt trop long ne
  // doit pas consommer une requête du budget journalier.
  private async skipReason(link: ChainLink, messages: LlmMessage[]): Promise<SkipReason | null> {
    if (
      link.maxPromptTokens !== undefined &&
      estimatePromptTokens(messages) > link.maxPromptTokens
    ) {
      return "prompt_too_large";
    }
    if (!link.budget) return null;
    try {
      return (await withTimeout(link.budget.tryConsume(), BUDGET_CHECK_MS))
        ? null
        : "daily_budget_reached";
    } catch {
      // Raison journalisée par l'appelant : l'échec du compteur reste visible.
      return "budget_unavailable";
    }
  }

  private isPaused(link: ChainLink): boolean {
    const until = this.pausedUntil.get(linkKey(link));
    return until !== undefined && until > Date.now();
  }

  // Seule une `LlmProviderError` fait passer au maillon suivant : toute autre
  // erreur est un bug de notre code, qu'aucun autre fournisseur ne corrigera.
  private handleFailure(link: ChainLink, error: unknown): void {
    if (!(error instanceof LlmProviderError)) throw error;
    const pausedForMs = error.retryAfterMs ?? DEFAULT_PAUSE_MS[error.failureCause];
    if (pausedForMs !== undefined) this.pausedUntil.set(linkKey(link), Date.now() + pausedForMs);
    this.log({
      event: "llm_fallback",
      provider: link.provider.name,
      model: link.provider.model,
      cause: error.failureCause,
      ...(pausedForMs !== undefined ? { pausedForMs } : {}),
    });
  }

  private async *stream(link: ChainLink, messages: LlmMessage[]): AsyncGenerator<string> {
    const controller = new AbortController();
    const stream = link.provider.streamResponse(messages, { signal: controller.signal });
    const iterator = stream[Symbol.asyncIterator]();
    const startedAt = Date.now();
    let started = false;
    let length = 0;
    try {
      while (true) {
        const budget = started
          ? STREAM_TOTAL_MS - (Date.now() - startedAt)
          : link.timeouts.firstChunkMs;
        const next = await nextBefore(iterator, budget, controller, link);
        if (next.done) return;
        if (next.value === "") continue;
        started = true;
        const room = MAX_RESPONSE_CHARS - length;
        length += next.value.length;
        if (length >= MAX_RESPONSE_CHARS) {
          yield next.value.slice(0, room);
          return;
        }
        yield next.value;
      }
    } finally {
      // Libère la connexion HTTP si on s'arrête avant la fin du flux.
      controller.abort();
    }
  }

  private async collectJson(
    link: ChainLink,
    messages: LlmMessage[],
    json: JsonOutputRequest,
  ): Promise<string> {
    const controller = new AbortController();
    const stream = link.provider.streamResponse(messages, { signal: controller.signal, json });
    const iterator = stream[Symbol.asyncIterator]();
    const deadline = Date.now() + link.timeouts.jsonResponseMs;
    let text = "";
    try {
      while (true) {
        const next = await nextBefore(iterator, deadline - Date.now(), controller, link);
        if (next.done) break;
        text += next.value;
        if (text.length > MAX_RESPONSE_CHARS) {
          throw new LlmProviderError(
            link.provider.name,
            "invalid_json",
            "réponse JSON trop longue",
          );
        }
      }
    } finally {
      controller.abort();
    }
    if (parseJsonOutput(text, json.schema) === null) {
      throw new LlmProviderError(link.provider.name, "invalid_json", "réponse JSON invalide");
    }
    return text;
  }
}

/**
 * Estimation large du nombre de tokens d'un prompt, sans tokenizer : environ
 * 3,6 caractères par token mesurés sur du français chez Groq (56 000
 * caractères comptés 15 357 tokens), arrondis à 3 pour se tromper plutôt
 * dans le sens de la prudence, plus quelques tokens de structure par message.
 */
export function estimatePromptTokens(messages: LlmMessage[]): number {
  return messages.reduce((total, message) => total + Math.ceil(message.content.length / 3) + 4, 0);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("délai dépassé")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function linkKey(link: ChainLink): string {
  return `${link.provider.name}:${link.provider.model}`;
}

/**
 * Attend le morceau suivant, au plus `budgetMs`. Au-delà, la requête HTTP est
 * annulée et le maillon compte comme n'ayant pas répondu.
 */
async function nextBefore(
  iterator: AsyncIterator<string>,
  budgetMs: number,
  controller: AbortController,
  link: ChainLink,
): Promise<IteratorResult<string>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => {
        controller.abort();
        reject(new LlmProviderError(link.provider.name, "timeout", "délai dépassé"));
      },
      Math.max(budgetMs, 0),
    );
  });
  try {
    return await Promise.race([iterator.next(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
