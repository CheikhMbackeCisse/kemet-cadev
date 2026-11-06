import { describe, expect, it } from "vitest";
import { classifyHttpFailure, readRetryAfterMs, toProviderError } from "./provider-failure.js";

function failure(status: number, headers: Record<string, string> = {}, body = "") {
  return { status, headers: new Headers(headers), body };
}

describe("classifyHttpFailure", () => {
  it.each([
    [429, "", "rate_limited"],
    [429, "Rate limit reached on tokens per minute (TPM): try again in 3s", "rate_limited"],
    [413, "Request too large for model on tokens per minute (TPM)", "prompt_too_large"],
    [400, '{"error":{"code":"context_length_exceeded"}}', "prompt_too_large"],
    [400, "", "rejected"],
    [402, "", "payment_required"],
    [404, "", "model_unavailable"],
    [500, "", "server_error"],
    [503, "", "server_error"],
    [401, "", "rejected"],
  ] as const)("HTTP %i %s : %s", (status, body, cause) => {
    expect(classifyHttpFailure(failure(status, {}, body))).toBe(cause);
  });
});

describe("readRetryAfterMs", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");

  it("lit retry-after en secondes", () => {
    expect(readRetryAfterMs("groq", failure(429, { "retry-after": "12" }), now)).toBe(12_000);
  });

  it("lit retry-after sous forme de date", () => {
    expect(
      readRetryAfterMs(
        "groq",
        failure(429, { "retry-after": "Tue, 03 Nov 2026 12:00:30 GMT" }),
        now,
      ),
    ).toBe(30_000);
  });

  it("lit le RetryInfo de Gemini dans le corps, et seulement pour Gemini", () => {
    const body = JSON.stringify({ error: { details: [{ retryDelay: "38s" }] } });
    expect(readRetryAfterMs("gemini", failure(429, {}, body), now)).toBe(38_000);
    expect(readRetryAfterMs("openrouter", failure(429, {}, body), now)).toBeUndefined();
  });

  it("lit X-RateLimit-Reset d'OpenRouter, une date en millisecondes, jusqu'à une journée", () => {
    const inTwelveHours = String(now + 12 * 3_600_000);
    expect(
      readRetryAfterMs("openrouter", failure(429, { "x-ratelimit-reset": inTwelveHours }), now),
    ).toBe(12 * 3_600_000);
    expect(
      readRetryAfterMs("groq", failure(429, { "x-ratelimit-reset": inTwelveHours }), now),
    ).toBeUndefined();
  });

  it("plafonne retry-after à une heure", () => {
    expect(readRetryAfterMs("groq", failure(429, { "retry-after": "999999" }), now)).toBe(
      3_600_000,
    );
  });
});

describe("toProviderError", () => {
  it("n'applique pas le retry-after joint au refus d'un prompt trop long", () => {
    const error = toProviderError("groq", failure(413, { "retry-after": "60" }));
    expect(error.failureCause).toBe("prompt_too_large");
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("met en pause sur un 429 de tokens par minute", () => {
    const error = toProviderError(
      "groq",
      failure(429, { "retry-after": "3" }, "tokens per minute"),
    );
    expect(error.failureCause).toBe("rate_limited");
    expect(error.retryAfterMs).toBe(3_000);
  });

  it("ne reprend jamais le corps de la réponse dans le message", () => {
    const error = toProviderError("groq", failure(400, {}, "organization org_secret"));
    expect(error.message).toBe("HTTP 400");
  });
});
