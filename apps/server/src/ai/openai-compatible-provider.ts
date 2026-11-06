import { zodSchema } from "ai";
import { z } from "zod";
import {
  LlmProviderError,
  type JsonOutputRequest,
  type LlmCallContext,
  type LlmMessage,
  type LlmProvider,
} from "./llm-provider.js";
import { toProviderError } from "./provider-failure.js";

export interface OpenAiCompatibleConfig {
  name: "groq" | "openrouter";
  baseUrl: string;
  apiKey: string;
  model: string;
}

// Une ligne SSE porte un seul morceau de quelques dizaines d'octets : au-delà
// de cette taille sans saut de ligne, le flux est cassé ou malveillant.
const MAX_EVENT_BYTES = 1_000_000;

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Groq et OpenRouter exposent tous deux l'API Chat Completions d'OpenAI. Un
// appel `fetch` direct suffit, sans SDK : on lit nous-mêmes le statut et les
// en-têtes (retry-after) dont la chaîne a besoin, et aucun SDK ne relance un
// appel en douce sur un quota gratuit de 50 requêtes par jour.
export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  return {
    name: config.name,
    model: config.model,
    async *streamResponse(messages: LlmMessage[], { signal, json }: LlmCallContext) {
      const body = {
        model: config.model,
        messages,
        ...modelOptions(config),
        ...(json
          ? { stream: false, response_format: responseFormat(config, json) }
          : { stream: true }),
      };
      const response = await post(config, body, signal);
      if (json) {
        yield await readCompletion(config, response);
        return;
      }
      yield* readEventStream(config, response);
    },
  };
}

function isGptOss(model: string): boolean {
  return model.startsWith("openai/gpt-oss");
}

// Les modèles gpt-oss raisonnent avant de répondre. Chez Groq, un effort
// "low" garde quelques dizaines de tokens de réflexion au lieu de centaines :
// la première phrase arrive plus vite et la limite de tokens par minute
// (8 000 sur l'offre gratuite) s'use moins. `include_reasoning: false` évite
// de recevoir ce raisonnement, qu'on n'affiche pas.
function modelOptions({ name, model }: OpenAiCompatibleConfig): Record<string, unknown> {
  if (name === "groq" && isGptOss(model))
    return { reasoning_effort: "low", include_reasoning: false };
  return {};
}

// Sorties structurées strictes (décodage contraint au schéma) : chez Groq,
// réservées aux modèles gpt-oss, et jamais en streaming, d'où `stream: false`
// pour toute demande JSON. Les autres modèles reçoivent le mode JSON simple,
// qui garantit du JSON mais pas sa forme : la validation Zod de la chaîne
// reste ce qui décide.
function responseFormat({ name, model }: OpenAiCompatibleConfig, json: JsonOutputRequest) {
  if (name === "groq" && isGptOss(model)) {
    const schema = zodSchema(json.schema).jsonSchema;
    return { type: "json_schema", json_schema: { name: json.name, strict: true, schema } };
  }
  return { type: "json_object" };
}

async function post(
  config: OpenAiCompatibleConfig,
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
      // La clé part dans l'en-tête : elle ne suit jamais une redirection.
      redirect: "error",
    });
  } catch {
    throw new LlmProviderError(config.name, "network", "appel interrompu");
  }
  if (!response.ok) {
    throw toProviderError(config.name, {
      status: response.status,
      headers: response.headers,
      body: await response.text().catch(() => ""),
    });
  }
  return response;
}

// Seuls les champs lus sont décrits ; un champ d'une autre forme (texte qui
// n'est pas une chaîne, événement `null`) rend la réponse illisible, ce qui
// fait passer au maillon suivant au lieu de lever une erreur de programme.
const payloadSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullish() }).nullish(),
        delta: z.object({ content: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
  error: z.object({ code: z.unknown() }).passthrough().nullish(),
});

type CompletionPayload = z.infer<typeof payloadSchema>;

function parsePayload(config: OpenAiCompatibleConfig, raw: unknown): CompletionPayload {
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw new LlmProviderError(config.name, "server_error", "réponse illisible");
  return parsed.data;
}

async function readCompletion(config: OpenAiCompatibleConfig, response: Response): Promise<string> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new LlmProviderError(config.name, "server_error", "réponse illisible");
  }
  const payload = parsePayload(config, raw);
  if (payload.error) throw streamError(config, payload.error);
  return payload.choices?.[0]?.message?.content ?? "";
}

/**
 * Lit un flux Server-Sent Events : une ligne `data: {...}` par morceau,
 * `data: [DONE]` à la fin. OpenRouter y glisse des commentaires (": OPENROUTER
 * PROCESSING") pour garder la connexion ouverte, et peut signaler une erreur
 * au milieu du flux par un morceau `{ "error": ... }`, sur un statut 200.
 */
async function* readEventStream(
  config: OpenAiCompatibleConfig,
  response: Response,
): AsyncGenerator<string> {
  if (!response.body) throw new LlmProviderError(config.name, "server_error", "flux absent");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    let chunk: Awaited<ReturnType<typeof reader.read>>;
    try {
      chunk = await reader.read();
    } catch {
      throw new LlmProviderError(config.name, "network", "flux interrompu");
    }
    if (chunk.done) return;
    buffer += chunk.value;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const data = line.slice("data:".length).trim();
      if (data === "[DONE]") return;
      const payload = parseEvent(config, data);
      if (payload.error) throw streamError(config, payload.error);
      const delta = payload.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
    // Reste une ligne incomplète : elle ne doit pas grossir sans fin.
    if (buffer.length > MAX_EVENT_BYTES) {
      throw new LlmProviderError(config.name, "server_error", "morceau trop long");
    }
  }
}

function parseEvent(config: OpenAiCompatibleConfig, data: string): CompletionPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    throw new LlmProviderError(config.name, "server_error", "morceau illisible");
  }
  return parsePayload(config, raw);
}

function streamError(config: OpenAiCompatibleConfig, error: { code?: unknown }): LlmProviderError {
  const status = typeof error.code === "number" ? error.code : 500;
  return toProviderError(config.name, { status, headers: new Headers(), body: "" });
}
