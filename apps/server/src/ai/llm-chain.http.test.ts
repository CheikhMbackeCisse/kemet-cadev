import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { inspect } from "node:util";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGeminiProvider } from "./gemini-provider.js";
import { LlmChain, type ChainLink, type FallbackLogEntry } from "./llm-chain.js";
import { AllProvidersUnavailableError, type LlmMessage, type LlmProvider } from "./llm-provider.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible-provider.js";

// Les vrais clients (SDK Google pour Gemini, appel fetch pour Groq et
// OpenRouter) contre un faux serveur local : c'est ici que se voit une erreur
// avalée par un SDK, qu'aucun faux fournisseur en mémoire ne montrerait.

const PROMPT = "Question confidentielle 7f3a";
// Une consigne système, comme dans chaque appel de l'orchestrateur : le SDK
// `ai` v7 rejette un message `system` mal placé avant même l'appel HTTP.
const SYSTEM = "Consigne de test";
const MESSAGES: LlmMessage[] = [
  { role: "system", content: SYSTEM },
  { role: "user", content: PROMPT },
];
const TIMEOUTS = { firstChunkMs: 300, jsonResponseMs: 300 };

type Scenario =
  | "ok"
  | "rate-limited"
  | "unavailable"
  | "silent"
  | "empty"
  | "too-large"
  | "json"
  | "null-event"
  | "object-content"
  | "endless-line"
  | "redirect";

interface ReceivedRequest {
  scenario: Scenario;
  body: Record<string, unknown>;
}

let server: Server;
let baseUrl: string;
const sockets = new Set<Socket>();
let received: ReceivedRequest[] = [];

function sse(response: ServerResponse, events: unknown[], done: boolean): void {
  response.writeHead(200, { "content-type": "text/event-stream" });
  for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
  if (done) response.write("data: [DONE]\n\n");
  response.end();
}

function respondGemini(scenario: Scenario, response: ServerResponse): void {
  if (scenario === "rate-limited") {
    response.writeHead(429, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message: "Quota exceeded",
          details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "38s" }],
        },
      }),
    );
    return;
  }
  if (scenario === "unavailable") {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "high demand" } }),
    );
    return;
  }
  if (scenario === "empty") {
    sse(
      response,
      [{ candidates: [{ content: { role: "model", parts: [] }, finishReason: "STOP" }] }],
      false,
    );
    return;
  }
  sse(
    response,
    [{ candidates: [{ content: { role: "model", parts: [{ text: "Bonjour" }] } }] }],
    false,
  );
}

function respondOpenAi(scenario: Scenario, response: ServerResponse): void {
  if (scenario === "rate-limited") {
    response.writeHead(429, { "content-type": "application/json", "retry-after": "12" });
    response.end(
      JSON.stringify({ error: { message: "Rate limit reached", code: "rate_limit_exceeded" } }),
    );
    return;
  }
  if (scenario === "too-large") {
    // Forme exacte du refus de Groq, retry-after compris.
    response.writeHead(413, { "content-type": "application/json", "retry-after": "60" });
    response.end(
      JSON.stringify({
        error: {
          message:
            "Request too large for model on tokens per minute (TPM): Limit 8000, Requested 15357",
          type: "tokens",
          code: "rate_limit_exceeded",
        },
      }),
    );
    return;
  }
  if (scenario === "unavailable") {
    response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Provider returned error", code: 502 } }));
    return;
  }
  if (scenario === "empty") {
    sse(response, [{ choices: [{ delta: {} }] }], true);
    return;
  }
  if (scenario === "null-event") {
    sse(response, [null], true);
    return;
  }
  if (scenario === "object-content") {
    sse(response, [{ choices: [{ delta: { content: { piege: true } } }] }], true);
    return;
  }
  if (scenario === "endless-line") {
    // Plus d'un mégaoctet sans saut de ligne, puis le serveur se tait.
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.write(`data: ${"x".repeat(1_100_000)}`);
    return;
  }
  if (scenario === "redirect") {
    response.writeHead(307, { location: `${baseUrl}/openai/ok/chat/completions` });
    response.end();
    return;
  }
  if (scenario === "json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: '{"answer":"oui"}' } }] }));
    return;
  }
  sse(response, [{ choices: [{ delta: { content: "Bonjour" } }] }], true);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const [, family, scenario] = (request.url ?? "").split("/") as [string, string, Scenario];
  let raw = "";
  for await (const chunk of request) raw += chunk;
  received.push({ scenario, body: JSON.parse(raw || "{}") as Record<string, unknown> });
  // "silent" : la requête est acceptée mais rien ne revient jamais.
  if (scenario === "silent") return;
  if (family === "gemini") respondGemini(scenario, response);
  else respondOpenAi(scenario, response);
}

function gemini(scenario: Scenario): ChainLink {
  return {
    provider: createGeminiProvider("cle-de-test", "gemini-test", `${baseUrl}/gemini/${scenario}`),
    timeouts: TIMEOUTS,
  };
}

function openAi(
  scenario: Scenario,
  name: "groq" | "openrouter" = "groq",
  model = "openai/gpt-oss-120b",
): ChainLink {
  return {
    provider: createOpenAiCompatibleProvider({
      name,
      baseUrl: `${baseUrl}/openai/${scenario}`,
      apiKey: "cle-de-test",
      model,
    }),
    timeouts: TIMEOUTS,
  };
}

async function answer(
  links: ChainLink[],
  logs: FallbackLogEntry[],
): Promise<{ provider: string; text: string }> {
  const chain = new LlmChain(links, (entry) => logs.push(entry));
  let text = "";
  let provider = "";
  for await (const chunk of chain.streamResponse(MESSAGES)) {
    text += chunk.delta;
    provider = chunk.provider;
  }
  return { provider, text };
}

beforeAll(async () => {
  server = createServer((request, response) => void handle(request, response));
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("adresse du faux serveur inconnue");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
});

describe("chaîne de secours contre un serveur HTTP", () => {
  let logs: FallbackLogEntry[];
  let consoleOutput: string[];

  beforeEach(() => {
    logs = [];
    received = [];
    consoleOutput = [];
    // Sans limite de profondeur : la console de Node coupe l'affichage à deux
    // niveaux, ce qui cache le prompt imbriqué dans `requestBodyValues`, mais
    // un journal qui sérialise l'objet entier l'écrirait.
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleOutput.push(args.map((arg) => inspect(arg, { depth: null })).join(" "));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Gemini (SDK ai)", () => {
    it("bascule sur un 429, sans nouvelle tentative, en lisant le délai dans le corps", async () => {
      const result = await answer([gemini("rate-limited"), openAi("ok")], logs);

      expect(result).toEqual({ provider: "groq", text: "Bonjour" });
      expect(received.filter((request) => request.scenario === "rate-limited")).toHaveLength(1);
      expect(logs[0]).toEqual({
        event: "llm_fallback",
        provider: "gemini",
        model: "gemini-test",
        cause: "rate_limited",
        pausedForMs: 38_000,
      });
    });

    it("bascule sur une erreur 5xx", async () => {
      const result = await answer([gemini("unavailable"), openAi("ok")], logs);
      expect(result.provider).toBe("groq");
      expect(logs[0]?.cause).toBe("server_error");
    });

    it("bascule quand rien ne revient avant le délai", async () => {
      const result = await answer([gemini("silent"), openAi("ok")], logs);
      expect(result.provider).toBe("groq");
      expect(logs[0]?.cause).toBe("timeout");
    });

    it("bascule sur un flux qui se termine sans texte", async () => {
      const result = await answer([gemini("empty"), openAi("ok")], logs);
      expect(result.provider).toBe("groq");
    });

    it("répond quand le serveur répond, consigne système comprise", async () => {
      expect(await answer([gemini("ok")], logs)).toEqual({ provider: "gemini", text: "Bonjour" });
      expect(received[0]?.body).toMatchObject({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: PROMPT }] }],
      });
    });

    it("n'écrit jamais le prompt dans la console quand l'appel échoue", async () => {
      await answer([gemini("rate-limited"), gemini("unavailable"), openAi("ok")], logs);
      expect(consoleOutput.join("\n")).not.toContain(PROMPT);
    });
  });

  describe("Groq et OpenRouter (fetch)", () => {
    it("bascule sur un 429 et respecte retry-after", async () => {
      const result = await answer(
        [openAi("rate-limited"), openAi("ok", "openrouter", "gemma:free")],
        logs,
      );
      expect(result.provider).toBe("openrouter");
      expect(logs[0]).toMatchObject({
        provider: "groq",
        cause: "rate_limited",
        pausedForMs: 12_000,
      });
    });

    it("bascule sur un prompt trop long sans mettre le modèle en pause", async () => {
      const result = await answer(
        [openAi("too-large"), openAi("ok", "openrouter", "gemma:free")],
        logs,
      );
      expect(result.provider).toBe("openrouter");
      expect(logs[0]).toEqual({
        event: "llm_fallback",
        provider: "groq",
        model: "openai/gpt-oss-120b",
        cause: "prompt_too_large",
      });
    });

    it("bascule sur un 5xx, sur un silence et sur un flux vide", async () => {
      const result = await answer(
        [
          openAi("unavailable", "openrouter"),
          openAi("silent"),
          openAi("empty"),
          openAi("ok", "openrouter", "dernier"),
        ],
        logs,
      );
      expect(result).toEqual({ provider: "openrouter", text: "Bonjour" });
      expect(logs.map((entry) => entry.cause)).toEqual(["server_error", "timeout", "server_error"]);
    });

    it("bascule sur un flux piégé au lieu de lever une erreur de programme", async () => {
      const result = await answer(
        [
          openAi("null-event"),
          openAi("object-content"),
          openAi("endless-line"),
          openAi("ok", "openrouter", "dernier"),
        ],
        logs,
      );
      expect(result).toEqual({ provider: "openrouter", text: "Bonjour" });
      expect(logs.map((entry) => entry.cause)).toEqual([
        "server_error",
        "server_error",
        "server_error",
      ]);
    });

    it("ne suit jamais une redirection avec la clé", async () => {
      const result = await answer(
        [openAi("redirect"), openAi("ok", "openrouter", "dernier")],
        logs,
      );
      expect(result.provider).toBe("openrouter");
      expect(received.filter((request) => request.scenario === "ok")).toHaveLength(1);
      expect(logs[0]?.cause).toBe("network");
    });

    it("lève AllProvidersUnavailableError quand tout échoue", async () => {
      await expect(
        answer([gemini("rate-limited"), openAi("rate-limited")], logs),
      ).rejects.toBeInstanceOf(AllProvidersUnavailableError);
    });

    it("limite la réflexion des modèles gpt-oss chez Groq", async () => {
      await answer([openAi("ok")], logs);
      expect(received[0]?.body).toMatchObject({
        stream: true,
        reasoning_effort: "low",
        include_reasoning: false,
      });
    });

    it("demande une sortie structurée stricte à gpt-oss chez Groq, sans streaming", async () => {
      const schema = z.object({ answer: z.string() });
      const chain = new LlmChain([openAi("json")], (entry) => logs.push(entry));
      const chunks = [];
      for await (const chunk of chain.streamResponse(MESSAGES, {
        json: { name: "reponse", schema },
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks).toEqual(['{"answer":"oui"}']);
      expect(received[0]?.body).toMatchObject({
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reponse",
            strict: true,
            schema: { type: "object", required: ["answer"] },
          },
        },
      });
    });

    it("demande le mode JSON simple aux autres modèles", async () => {
      const provider: LlmProvider = openAi("json", "openrouter", "gemma:free").provider;
      const chain = new LlmChain([{ provider, timeouts: TIMEOUTS }], (entry) => logs.push(entry));
      for await (const chunk of chain.streamResponse(MESSAGES, {
        json: { name: "reponse", schema: z.object({ answer: z.string() }) },
      })) {
        expect(chunk.delta).toBe('{"answer":"oui"}');
      }
      expect(received[0]?.body).toMatchObject({
        stream: false,
        response_format: { type: "json_object" },
      });
      expect(received[0]?.body).not.toHaveProperty("reasoning_effort");
    });
  });
});
