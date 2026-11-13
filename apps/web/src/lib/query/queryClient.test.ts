import { describe, expect, it } from "vitest";
import { ChatApiError } from "../chat/api.js";
import { shouldRetry } from "./queryClient.js";

describe("nouvelles tentatives d'une lecture", () => {
  it("ne réessaie jamais une erreur 4xx", () => {
    expect(shouldRetry(0, new ChatApiError("not_found", "introuvable", 404))).toBe(false);
  });

  it("réessaie deux fois une panne réseau ou une erreur 5xx", () => {
    const serverError = new ChatApiError("unknown_error", "erreur", 503);
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(2, serverError)).toBe(false);
  });
});
