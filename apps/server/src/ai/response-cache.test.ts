import { describe, expect, it } from "vitest";
import { InMemoryResponseCache, buildCacheKey } from "./response-cache.js";

describe("buildCacheKey", () => {
  it("produit la même clé pour une question reformatée en espaces et casse", () => {
    const a = buildCacheKey("Comment   gérer un remboursement ?", ["skill-1"]);
    const b = buildCacheKey("comment gérer un remboursement ?", ["skill-1"]);
    expect(a).toBe(b);
  });

  it("produit la même clé peu importe l'ordre des skills", () => {
    const a = buildCacheKey("question", ["skill-1", "skill-2"]);
    const b = buildCacheKey("question", ["skill-2", "skill-1"]);
    expect(a).toBe(b);
  });

  it("distingue deux ensembles de skills différents", () => {
    const a = buildCacheKey("question", ["skill-1"]);
    const b = buildCacheKey("question", ["skill-2"]);
    expect(a).not.toBe(b);
  });
});

describe("InMemoryResponseCache", () => {
  it("renvoie null pour une clé absente", async () => {
    const cache = new InMemoryResponseCache();
    expect(await cache.get("absent")).toBeNull();
  });

  it("renvoie la valeur stockée avant expiration", async () => {
    const cache = new InMemoryResponseCache();
    await cache.set("une-cle", "une réponse", 60);
    expect(await cache.get("une-cle")).toBe("une réponse");
  });

  it("expire une entrée après son TTL", async () => {
    const cache = new InMemoryResponseCache();
    await cache.set("une-cle", "une réponse", -1);
    expect(await cache.get("une-cle")).toBeNull();
  });
});
