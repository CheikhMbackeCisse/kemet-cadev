import type Redis from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryDailyBudget, RedisDailyBudget } from "./daily-budget.js";

class FakeRedis {
  values = new Map<string, number>();
  expirations = new Map<string, number>();
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
      expire: (key: string, seconds: number, mode: "NX") => {
        steps.push(() => {
          if (mode === "NX" && this.expirations.has(key)) return [null, 0];
          this.expirations.set(key, seconds);
          return [null, 1];
        });
        return chain;
      },
      exec: async () => steps.map((step) => step()),
    };
    return chain;
  }
  async decr(key: string) {
    const value = (this.values.get(key) ?? 0) - 1;
    this.values.set(key, value);
    return value;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("RedisDailyBudget", () => {
  it("compte jusqu'à la limite, puis refuse sans dépasser le compteur", async () => {
    const redis = new FakeRedis();
    const budget = new RedisDailyBudget(redis as unknown as Redis, "openrouter", 2);

    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(false);
    expect([...redis.values.values()]).toEqual([2]);
  });

  it("utilise une clé par jour UTC, qui expire d'elle-même", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T23:59:00Z") });
    const redis = new FakeRedis();
    const budget = new RedisDailyBudget(redis as unknown as Redis, "openrouter", 1);

    await budget.tryConsume();
    vi.setSystemTime(new Date("2026-11-04T00:01:00Z"));
    expect(await budget.tryConsume()).toBe(true);

    expect([...redis.values.keys()]).toEqual([
      "llm-budget:openrouter:2026-11-03",
      "llm-budget:openrouter:2026-11-04",
    ]);
    expect(redis.expirations.get("llm-budget:openrouter:2026-11-04")).toBe(172_800);
  });
});

describe("MemoryDailyBudget", () => {
  it("repart à zéro le lendemain", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T10:00:00Z") });
    const budget = new MemoryDailyBudget(1);
    expect(await budget.tryConsume()).toBe(true);
    expect(await budget.tryConsume()).toBe(false);
    vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
    expect(await budget.tryConsume()).toBe(true);
  });
});
