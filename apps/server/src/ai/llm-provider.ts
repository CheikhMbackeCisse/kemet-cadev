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

/**
 * Ce que l'orchestrateur attend réellement (voir assistant-orchestrator.ts) :
 * un flux de morceaux déjà attribués à un fournisseur. Découplé de la classe
 * concrète `FallbackLlmProvider` pour accepter un faux fournisseur dans les
 * tests sans construire de vrais clients Gemini ou OpenRouter.
 */
export interface StreamingLlmProvider {
  streamResponse(messages: LlmMessage[]): AsyncIterable<LlmStreamChunk>;
}

/**
 * Bascule automatique du principal vers le secours en cas d'erreur de
 * quota (429) ou d'indisponibilité, voir docs/CONTEXTE.md section IA. Le
 * flux du principal n'est utilisé que si son premier morceau arrive sans
 * erreur : un échec après le début du flux n'est pas rejoué, pour ne pas
 * envoyer une réponse à moitié écrite deux fois à l'utilisateur.
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
      // Un échec après que des morceaux ont déjà été diffusés n'est jamais
      // rejoué sur le secours : l'utilisateur recevrait une réponse à
      // moitié écrite suivie d'une réponse complète distincte.
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
