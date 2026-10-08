import { afterEach, describe, expect, it, vi } from "vitest";
import { checkService } from "./serviceStatus.js";

describe("checkService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retourne ok quand la réponse est positive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    await expect(checkService("/api/health")).resolves.toBe("ok");
  });

  it("retourne indisponible sur une réponse en erreur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(checkService("/api/health")).resolves.toBe("indisponible");
  });

  it("retourne indisponible quand la requête échoue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      }),
    );
    await expect(checkService("/api/health")).resolves.toBe("indisponible");
  });
});
