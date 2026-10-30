export type LlmProviderName = "gemini" | "openrouter";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmStreamChunk {
  provider: LlmProviderName;
  delta: string;
}

/**
 * Erreur normalisée pour que l'appelant distingue un quota dépassé (429,
 * bascule possible sur le secours) d'une autre panne (réseau, 5xx côté
 * fournisseur, toujours une bascule) sans dépendre de la forme de l'erreur
 * propre à chaque SDK.
 */
export class LlmProviderError extends Error {
  constructor(
    public readonly provider: LlmProviderName,
    public readonly quotaExceeded: boolean,
    message: string,
  ) {
    super(message);
  }
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  streamResponse(messages: LlmMessage[]): AsyncIterable<string>;
}

/** Séparé de `FallbackLlmProvider` pour accepter un faux fournisseur dans les tests. */
export interface StreamingLlmProvider {
  streamResponse(messages: LlmMessage[]): AsyncIterable<LlmStreamChunk>;
}

/**
 * Bascule automatique du principal vers le secours en cas d'erreur de
 * quota (429) ou d'indisponibilité. Un échec après le premier morceau n'est
 * pas rejoué : l'utilisateur recevrait une réponse à moitié écrite, puis une
 * autre.
 */
export class FallbackLlmProvider {
  constructor(
    private readonly primary: LlmProvider,
    private readonly fallback: LlmProvider,
  ) {}

  async *streamResponse(messages: LlmMessage[]): AsyncGenerator<LlmStreamChunk> {
    let started = false;
    try {
      for await (const delta of this.primary.streamResponse(messages)) {
        started = true;
        yield { provider: this.primary.name, delta };
      }
      return;
    } catch (error) {
      if (started || !(error instanceof LlmProviderError)) throw error;
    }

    for await (const delta of this.fallback.streamResponse(messages)) {
      yield { provider: this.fallback.name, delta };
    }
  }
}

export class BothProvidersUnavailableError extends Error {
  constructor() {
    super("L'assistant est momentanément indisponible : les deux fournisseurs d'IA sont saturés.");
  }
}

export function extractHttpStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { statusCode?: unknown; status?: unknown };
  const value = candidate.statusCode ?? candidate.status;
  return typeof value === "number" ? value : undefined;
}
