import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MemoryDailyBudget } from "./daily-budget.js";
import {
  LlmChain,
  MAX_RESPONSE_CHARS,
  estimatePromptTokens,
  type ChainLink,
  type FallbackLogEntry,
} from "./llm-chain.js";
import {
  AllProvidersUnavailableError,
  LlmProviderError,
  type LlmCallContext,
  type LlmMessage,
  type LlmProvider,
  type LlmProviderName,
  type LlmRequestOptions,
} from "./llm-provider.js";

const TIMEOUTS = { firstChunkMs: 1_000, jsonResponseMs: 2_000 };
const MESSAGES: LlmMessage[] = [{ role: "user", content: "Question secrète de test" }];
const JSON_REQUEST = { name: "test", schema: z.object({ answer: z.string() }) };

interface FakeProvider extends LlmProvider {
  calls: LlmCallContext[];
}

function provider(
  name: LlmProviderName,
  model: string,
  behaviour: (context: LlmCallContext) => AsyncGenerator<string>,
): FakeProvider {
  const calls: LlmCallContext[] = [];
  return {
    name,
    model,
    calls,
    streamResponse(_messages, context) {
      calls.push(context);
      return behaviour(context);
    },
  };
}

function answering(name: LlmProviderName, model: string, ...chunks: string[]): FakeProvider {
  return provider(name, model, async function* () {
    for (const chunk of chunks) yield chunk;
  });
}

function failing(
  name: LlmProviderName,
  model: string,
  error: () => LlmProviderError,
): FakeProvider {
  // eslint-disable-next-line require-yield -- échoue avant tout morceau.
  return provider(name, model, async function* () {
    throw error();
  });
}

// Ne répond jamais, mais s'arrête quand la chaîne annule l'appel, comme le
// ferait une vraie requête HTTP.
function silent(name: LlmProviderName, model: string): FakeProvider {
  // eslint-disable-next-line require-yield -- n'envoie jamais rien.
  return provider(name, model, async function* ({ signal }) {
    await new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error("abort"))),
    );
  });
}

function link(fake: FakeProvider, extra: Partial<ChainLink> = {}): ChainLink {
  return { provider: fake, timeouts: TIMEOUTS, ...extra };
}

async function collect(chain: LlmChain, options?: LlmRequestOptions) {
  const chunks = [];
  for await (const chunk of chain.streamResponse(MESSAGES, options)) chunks.push(chunk);
  return chunks;
}

describe("LlmChain", () => {
  let logs: FallbackLogEntry[];
  const logger = (entry: FallbackLogEntry) => logs.push(entry);

  beforeEach(() => {
    logs = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("répond avec le premier maillon quand il répond", async () => {
    const second = answering("groq", "b", "non");
    const chain = new LlmChain(
      [link(answering("gemini", "a", "Bon", "jour")), link(second)],
      logger,
    );

    const chunks = await collect(chain);

    expect(chunks).toEqual([
      { provider: "gemini", model: "a", delta: "Bon" },
      { provider: "gemini", model: "a", delta: "jour" },
    ]);
    expect(second.calls).toHaveLength(0);
    expect(logs).toEqual([]);
  });

  it("passe au suivant sur un 429 et met le maillon en pause le temps annoncé", async () => {
    vi.useFakeTimers();
    const limited = failing(
      "gemini",
      "a",
      () => new LlmProviderError("gemini", "rate_limited", "HTTP 429", 30_000),
    );
    const chain = new LlmChain([link(limited), link(answering("groq", "b", "ok"))], logger);

    expect((await collect(chain))[0]?.provider).toBe("groq");
    expect(logs).toEqual([
      {
        event: "llm_fallback",
        provider: "gemini",
        model: "a",
        cause: "rate_limited",
        pausedForMs: 30_000,
      },
    ]);

    await collect(chain);
    expect(limited.calls).toHaveLength(1);

    vi.advanceTimersByTime(30_001);
    await collect(chain);
    expect(limited.calls).toHaveLength(2);
  });

  it("passe au suivant sur une erreur 5xx sans mettre le maillon en pause", async () => {
    const broken = failing(
      "gemini",
      "a",
      () => new LlmProviderError("gemini", "server_error", "HTTP 503"),
    );
    const chain = new LlmChain([link(broken), link(answering("groq", "b", "ok"))], logger);

    await collect(chain);
    await collect(chain);

    expect(broken.calls).toHaveLength(2);
    expect(logs[0]).toEqual({
      event: "llm_fallback",
      provider: "gemini",
      model: "a",
      cause: "server_error",
    });
  });

  it("passe au suivant quand le premier morceau n'arrive pas à temps, et annule l'appel", async () => {
    vi.useFakeTimers();
    const slow = silent("gemini", "a");
    const chain = new LlmChain([link(slow), link(answering("groq", "b", "ok"))], logger);

    const pending = collect(chain);
    await vi.advanceTimersByTimeAsync(TIMEOUTS.firstChunkMs + 1);

    expect((await pending)[0]?.provider).toBe("groq");
    expect(slow.calls[0]?.signal.aborted).toBe(true);
    expect(logs[0]?.cause).toBe("timeout");
  });

  it("passe au suivant quand le JSON demandé ne passe pas la validation Zod", async () => {
    const chain = new LlmChain(
      [
        link(answering("gemini", "a", '{"wrong":1}')),
        link(answering("groq", "b", 'Voici : {"answer":"oui"}')),
      ],
      logger,
    );

    const chunks = await collect(chain, { json: JSON_REQUEST });

    expect(chunks).toEqual([{ provider: "groq", model: "b", delta: 'Voici : {"answer":"oui"}' }]);
    expect(logs[0]?.cause).toBe("invalid_json");
  });

  it("transmet la demande de JSON au fournisseur", async () => {
    const fake = answering("gemini", "a", '{"answer":"oui"}');
    await collect(new LlmChain([link(fake)], logger), { json: JSON_REQUEST });
    expect(fake.calls[0]?.json).toBe(JSON_REQUEST);
  });

  it("passe au suivant quand le fournisseur refuse un prompt trop long", async () => {
    const chain = new LlmChain(
      [
        link(
          failing("groq", "a", () => new LlmProviderError("groq", "prompt_too_large", "HTTP 413")),
        ),
        link(answering("openrouter", "b", "ok")),
      ],
      logger,
    );

    expect((await collect(chain))[0]?.provider).toBe("openrouter");
    expect(logs[0]).toEqual({
      event: "llm_fallback",
      provider: "groq",
      model: "a",
      cause: "prompt_too_large",
    });
  });

  it("saute sans l'appeler un maillon dont la limite de tokens est dépassée par le prompt", async () => {
    const groq = answering("groq", "a", "non");
    const chain = new LlmChain(
      [
        link(groq, { maxPromptTokens: estimatePromptTokens(MESSAGES) - 1 }),
        link(answering("openrouter", "b", "ok")),
      ],
      logger,
    );

    expect((await collect(chain))[0]?.provider).toBe("openrouter");
    expect(groq.calls).toHaveLength(0);
    expect(logs[0]).toEqual({
      event: "llm_skipped",
      provider: "groq",
      model: "a",
      cause: "prompt_too_large",
    });
  });

  it("saute OpenRouter quand son budget du jour est épuisé, sans bloquer les autres", async () => {
    const budget = new MemoryDailyBudget(1);
    const first = answering("openrouter", "a", "ok");
    const second = answering("openrouter", "b", "ok");
    const chain = new LlmChain([link(first, { budget }), link(second, { budget })], logger);

    await collect(chain);
    await expect(collect(chain)).rejects.toBeInstanceOf(AllProvidersUnavailableError);

    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(0);
    expect(logs.filter((entry) => entry.cause === "daily_budget_reached")).toHaveLength(2);
  });

  it("ne consomme pas le budget quand le prompt est trop long pour le maillon", async () => {
    const budget = new MemoryDailyBudget(1);
    const chain = new LlmChain(
      [
        link(answering("openrouter", "a", "non"), { budget, maxPromptTokens: 1 }),
        link(answering("openrouter", "b", "ok"), { budget }),
      ],
      logger,
    );

    expect((await collect(chain))[0]?.model).toBe("b");
  });

  it("saute OpenRouter quand son compteur ne répond pas, au lieu d'arrêter la chaîne", async () => {
    const failingBudget = { tryConsume: () => Promise.reject(new Error("Valkey injoignable")) };
    const openRouter = answering("openrouter", "a", "non");
    const chain = new LlmChain(
      [link(openRouter, { budget: failingBudget }), link(answering("groq", "b", "ok"))],
      logger,
    );

    expect((await collect(chain))[0]?.provider).toBe("groq");
    expect(openRouter.calls).toHaveLength(0);
    expect(logs[0]).toEqual({
      event: "llm_skipped",
      provider: "openrouter",
      model: "a",
      cause: "budget_unavailable",
    });
  });

  it("n'attend pas plus d'une seconde un compteur qui ne répond pas", async () => {
    vi.useFakeTimers();
    const hangingBudget = { tryConsume: () => new Promise<boolean>(() => {}) };
    const chain = new LlmChain(
      [
        link(answering("openrouter", "a", "non"), { budget: hangingBudget }),
        link(answering("groq", "b", "ok")),
      ],
      logger,
    );

    const pending = collect(chain);
    await vi.advanceTimersByTimeAsync(1_001);
    expect((await pending)[0]?.provider).toBe("groq");
  });

  it("coupe une réponse qui dépasse la taille maximale", async () => {
    const endless = provider("gemini", "a", async function* () {
      while (true) yield "x".repeat(1_000);
    });
    const text = (await collect(new LlmChain([link(endless)], logger)))
      .map((chunk) => chunk.delta)
      .join("");
    expect(text).toHaveLength(MAX_RESPONSE_CHARS);
    expect(endless.calls[0]?.signal.aborted).toBe(true);
  });

  it("rejette une réponse JSON trop longue et passe au suivant", async () => {
    const chain = new LlmChain(
      [
        link(answering("gemini", "a", `{"answer":"${"x".repeat(MAX_RESPONSE_CHARS)}"}`)),
        link(answering("groq", "b", '{"answer":"oui"}')),
      ],
      logger,
    );
    expect((await collect(chain, { json: JSON_REQUEST }))[0]?.provider).toBe("groq");
    expect(logs[0]?.cause).toBe("invalid_json");
  });

  it("lève AllProvidersUnavailableError quand toute la chaîne échoue", async () => {
    const chain = new LlmChain(
      [
        link(
          failing("gemini", "a", () => new LlmProviderError("gemini", "rate_limited", "HTTP 429")),
        ),
        link(failing("groq", "b", () => new LlmProviderError("groq", "server_error", "HTTP 500"))),
      ],
      logger,
    );

    await expect(collect(chain)).rejects.toBeInstanceOf(AllProvidersUnavailableError);
    expect(logs.map((entry) => entry.event)).toEqual([
      "llm_fallback",
      "llm_fallback",
      "llm_chain_exhausted",
    ]);
  });

  it("traite une réponse vide comme un échec", async () => {
    const chain = new LlmChain(
      [link(answering("gemini", "a")), link(answering("groq", "b", "ok"))],
      logger,
    );
    expect((await collect(chain))[0]?.provider).toBe("groq");
  });

  it("ne rejoue pas la question ailleurs après un premier morceau", async () => {
    const second = answering("groq", "b", "autre réponse");
    const chain = new LlmChain(
      [
        link(
          provider("gemini", "a", async function* () {
            yield "Début";
            throw new LlmProviderError("gemini", "server_error", "coupé");
          }),
        ),
        link(second),
      ],
      logger,
    );

    const received: string[] = [];
    await expect(async () => {
      for await (const chunk of chain.streamResponse(MESSAGES)) received.push(chunk.delta);
    }).rejects.toBeInstanceOf(LlmProviderError);
    expect(received).toEqual(["Début"]);
    expect(second.calls).toHaveLength(0);
    expect(logs).toEqual([
      { event: "llm_failed_mid_stream", provider: "gemini", model: "a", cause: "server_error" },
    ]);
  });

  it("propage une erreur qui n'est pas une LlmProviderError sans tenter le suivant", async () => {
    const second = answering("groq", "b", "ok");
    const chain = new LlmChain(
      [
        link(
          // eslint-disable-next-line require-yield -- échoue avant tout morceau.
          provider("gemini", "a", async function* () {
            throw new TypeError("bug");
          }),
        ),
        link(second),
      ],
      logger,
    );

    await expect(collect(chain)).rejects.toBeInstanceOf(TypeError);
    expect(second.calls).toHaveLength(0);
  });

  it("ne journalise jamais le prompt ni la réponse", async () => {
    const chain = new LlmChain(
      [
        link(
          failing("gemini", "a", () => new LlmProviderError("gemini", "rate_limited", "HTTP 429")),
        ),
        link(answering("groq", "b", "Réponse privée")),
      ],
      logger,
    );
    await collect(chain);
    const written = JSON.stringify(logs);
    expect(written).not.toContain("Question secrète");
    expect(written).not.toContain("Réponse privée");
  });
});
