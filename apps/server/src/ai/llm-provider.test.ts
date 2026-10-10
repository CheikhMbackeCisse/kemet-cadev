import { describe, expect, it } from "vitest";
import { FallbackLlmProvider, LlmProviderError, type LlmMessage, type LlmProvider } from "./llm-provider.js";

function providerThatYields(name: "gemini" | "openrouter", chunks: string[]): LlmProvider {
  return {
    name,
    async *streamResponse() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

function providerThatFailsBeforeAnyChunk(name: "gemini" | "openrouter", quotaExceeded: boolean): LlmProvider {
  return {
    name,
    // eslint-disable-next-line require-yield
    async *streamResponse() {
      throw new LlmProviderError(name, quotaExceeded, `${name} indisponible`);
    },
  };
}

function providerThatFailsAfterOneChunk(name: "gemini" | "openrouter"): LlmProvider {
  return {
    name,
    async *streamResponse() {
      yield "déjà écrit ";
      throw new LlmProviderError(name, false, `${name} coupé en cours de flux`);
    },
  };
}

async function collect(provider: FallbackLlmProvider, messages: LlmMessage[] = []) {
  const chunks: { provider: string; delta: string }[] = [];
  for await (const chunk of provider.streamResponse(messages)) chunks.push(chunk);
  return chunks;
}

describe("FallbackLlmProvider", () => {
  it("utilise le principal quand il répond", async () => {
    const provider = new FallbackLlmProvider(
      providerThatYields("gemini", ["bon", "jour"]),
      providerThatYields("openrouter", ["ne devrait jamais arriver"]),
    );
    const chunks = await collect(provider);
    expect(chunks).toEqual([
      { provider: "gemini", delta: "bon" },
      { provider: "gemini", delta: "jour" },
    ]);
  });

  it("bascule sur le secours si le principal échoue avant tout morceau (quota)", async () => {
    const provider = new FallbackLlmProvider(
      providerThatFailsBeforeAnyChunk("gemini", true),
      providerThatYields("openrouter", ["secours"]),
    );
    const chunks = await collect(provider);
    expect(chunks).toEqual([{ provider: "openrouter", delta: "secours" }]);
  });

  it("bascule sur le secours si le principal est indisponible (hors quota)", async () => {
    const provider = new FallbackLlmProvider(
      providerThatFailsBeforeAnyChunk("gemini", false),
      providerThatYields("openrouter", ["secours"]),
    );
    const chunks = await collect(provider);
    expect(chunks).toEqual([{ provider: "openrouter", delta: "secours" }]);
  });

  it("ne rejoue jamais sur le secours après un échec en cours de flux", async () => {
    const provider = new FallbackLlmProvider(
      providerThatFailsAfterOneChunk("gemini"),
      providerThatYields("openrouter", ["ne devrait jamais arriver"]),
    );
    const iterator = provider.streamResponse([])[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first).toEqual({ done: false, value: { provider: "gemini", delta: "déjà écrit " } });
    await expect(iterator.next()).rejects.toThrow("gemini coupé en cours de flux");
  });

  it("propage une erreur qui n'est pas une LlmProviderError sans tenter le secours", async () => {
    const provider = new FallbackLlmProvider(
      {
        name: "gemini",
        // eslint-disable-next-line require-yield
        async *streamResponse() {
          throw new Error("panne inattendue");
        },
      },
      providerThatYields("openrouter", ["ne devrait jamais arriver"]),
    );
    await expect(collect(provider)).rejects.toThrow("panne inattendue");
  });
});
