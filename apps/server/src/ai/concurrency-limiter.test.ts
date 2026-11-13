import { describe, expect, it } from "vitest";
import { ConcurrencyLimiter, resolveMaxConcurrentAnswers } from "./concurrency-limiter.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe("ConcurrencyLimiter", () => {
  it("garde au plus trois tâches en cours, les autres attendent dans l'ordre", async () => {
    const limiter = new ConcurrencyLimiter(3);
    const gates = Array.from({ length: 5 }, deferred);
    const started: number[] = [];
    const tasks = gates.map((gate, index) =>
      limiter.run(async () => {
        started.push(index);
        await gate.promise;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    expect(limiter.activeCount).toBe(3);
    expect(limiter.waitingCount).toBe(2);

    gates[1]!.resolve();
    await tasks[1];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);
    expect(limiter.activeCount).toBe(3);

    for (const gate of gates) gate.resolve();
    await Promise.all(tasks);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(limiter.activeCount).toBe(0);
  });

  it("libère la place d'une tâche qui échoue", async () => {
    const limiter = new ConcurrencyLimiter(1);
    await expect(limiter.run(() => Promise.reject(new Error("panne")))).rejects.toThrow("panne");
    expect(await limiter.run(async () => "suite")).toBe("suite");
    expect(limiter.activeCount).toBe(0);
  });

  it("lit la limite dans l'environnement, bornée entre 1 et 20", () => {
    expect(resolveMaxConcurrentAnswers({})).toBe(3);
    expect(resolveMaxConcurrentAnswers({ ASSISTANT_MAX_CONCURRENT_ANSWERS: "5" })).toBe(5);
    expect(resolveMaxConcurrentAnswers({ ASSISTANT_MAX_CONCURRENT_ANSWERS: "0" })).toBe(1);
    expect(resolveMaxConcurrentAnswers({ ASSISTANT_MAX_CONCURRENT_ANSWERS: "500" })).toBe(20);
    expect(resolveMaxConcurrentAnswers({ ASSISTANT_MAX_CONCURRENT_ANSWERS: "trois" })).toBe(3);
  });
});
