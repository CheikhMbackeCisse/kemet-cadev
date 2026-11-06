import type { ZodType } from "zod";

export type LlmProviderName = "gemini" | "groq" | "openrouter";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmStreamChunk {
  provider: LlmProviderName;
  model: string;
  delta: string;
}

/**
 * Demande une réponse JSON conforme à `schema`. La chaîne attend alors la
 * réponse entière, la valide, et passe au modèle suivant si elle ne l'est pas.
 */
export interface JsonOutputRequest {
  /** Nom court du format, transmis aux API qui gèrent les sorties structurées. */
  name: string;
  schema: ZodType<unknown>;
}

export interface LlmRequestOptions {
  json?: JsonOutputRequest;
}

/**
 * Raison pour laquelle un modèle n'a pas répondu. Elle est journalisée
 * telle quelle et décide si le modèle est mis en pause pour les requêtes
 * suivantes (voir `LlmChain`).
 */
export type LlmFailureCause =
  | "rate_limited"
  | "prompt_too_large"
  | "server_error"
  | "timeout"
  | "invalid_json"
  | "model_unavailable"
  | "payment_required"
  | "rejected"
  | "network";

/**
 * Erreur normalisée d'un fournisseur. Le message ne reprend jamais le corps
 * de la requête : les erreurs des SDK le gardent (`requestBodyValues`), et
 * il contient le prompt, qui ne doit pas finir dans un journal.
 */
export class LlmProviderError extends Error {
  constructor(
    public readonly provider: LlmProviderName,
    public readonly failureCause: LlmFailureCause,
    message: string,
    /** Délai demandé par le fournisseur avant de le rappeler, quand il en donne un. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Contexte d'un appel : `signal` est déclenché par la chaîne quand le délai est dépassé. */
export interface LlmCallContext extends LlmRequestOptions {
  signal: AbortSignal;
}

/** Un modèle chez un fournisseur : un maillon de la chaîne de secours. */
export interface LlmProvider {
  readonly name: LlmProviderName;
  readonly model: string;
  streamResponse(messages: LlmMessage[], context: LlmCallContext): AsyncIterable<string>;
}

/** Ce que consomment l'orchestrateur et ses tests : la chaîne, ou un faux. */
export interface StreamingLlmProvider {
  streamResponse(
    messages: LlmMessage[],
    options?: LlmRequestOptions,
  ): AsyncIterable<LlmStreamChunk>;
}

export class AllProvidersUnavailableError extends Error {
  constructor() {
    super("Aucun fournisseur d'IA n'a pu répondre.");
  }
}

/**
 * Remplace la chaîne quand aucune clé d'API n'est configurée mais que les
 * réponses enregistrées sont activées : chaque appel échoue, et seule une
 * question de démo connue reçoit une réponse.
 */
export class UnavailableLlmProvider implements StreamingLlmProvider {
  // eslint-disable-next-line require-yield -- échoue toujours, avant tout morceau.
  async *streamResponse(): AsyncGenerator<LlmStreamChunk> {
    throw new AllProvidersUnavailableError();
  }
}
