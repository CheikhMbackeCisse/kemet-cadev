import type Redis from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RedisQuotaCounter } from "./quota.js";

// Chaque commande rend la main avant de s'exécuter, comme un vrai aller-retour
// réseau : des appels lancés ensemble s'entrelacent.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

class FakeRedis {
  values = new Map<string, number>();
  expirations = new Map<string, number>();
  async exists(key: string) {
    await tick();
    return this.values.has(key) ? 1 : 0;
  }
  async set(key: string, value: number, _ex: "EX", seconds: number, _mode: "NX") {
    await tick();
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    this.expirations.set(key, seconds);
    return "OK";
  }
  multi() {
    const steps: (() => [null, number])[] = [];
    const chain = {
      incr: (key: string) => {
        steps.push(() => {
          const value = (this.values.get(key) ?? 0) + 1;
          this.values.set(key, value);
          return [null, value];
        });
        return chain;
      },
      expire: (key: string, seconds: number) => {
        steps.push(() => {
          if (!this.expirations.has(key)) this.expirations.set(key, seconds);
          return [null, 1];
        });
        return chain;
      },
      exec: async () => {
        await tick();
        return steps.map((step) => step());
      },
    };
    return chain;
  }
  async decr(key: string) {
    await tick();
    const value = (this.values.get(key) ?? 0) - 1;
    this.values.set(key, value);
    return value;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RedisQuotaCounter", () => {
  it("n'accepte pas plus d'appels simultanés que le quota", async () => {
    const redis = new FakeRedis();
    const counter = new RedisQuotaCounter(redis as unknown as Redis);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => counter.tryConsume("profil", 3, async () => 0)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect([...redis.values.values()]).toEqual([3]);
  });

  it("part du total de la base à son premier usage de la journée", async () => {
    const redis = new FakeRedis();
    const counter = new RedisQuotaCounter(redis as unknown as Redis);
    const countToday = vi.fn(async () => 29);
    expect(await counter.tryConsume("profil", 30, countToday)).toEqual({ allowed: true, usedToday: 30 });
    expect(await counter.tryConsume("profil", 30, countToday)).toEqual({ allowed: false, usedToday: 30 });
    expect(countToday).toHaveBeenCalledTimes(1);
  });

  it("utilise une clé par personne et par jour UTC, avec une durée de vie", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-09T23:59:00Z"), toFake: ["Date"] });
    const redis = new FakeRedis();
    const counter = new RedisQuotaCounter(redis as unknown as Redis);
    await counter.tryConsume("a", 1, async () => 0);
    await counter.tryConsume("b", 1, async () => 0);
    vi.setSystemTime(new Date("2026-11-10T00:01:00Z"));
    expect((await counter.tryConsume("a", 1, async () => 0)).allowed).toBe(true);
    expect([...redis.values.keys()]).toEqual([
      "assistant-quota:a:2026-11-09",
      "assistant-quota:b:2026-11-09",
      "assistant-quota:a:2026-11-10",
    ]);
    expect([...redis.expirations.values()].every((seconds) => seconds > 0)).toBe(true);
  });
});

describe("RedisQuotaCounter.release", () => {
  it("rend un appel compté", async () => {
    const redis = new FakeRedis();
    const counter = new RedisQuotaCounter(redis as unknown as Redis);
    await counter.tryConsume("profil", 1, async () => 0);
    await counter.release("profil");
    expect((await counter.tryConsume("profil", 1, async () => 0)).allowed).toBe(true);
  });
});
