/** Réponses de @kemet rédigées en même temps par une instance de l'API, salons et posts confondus. */
export const DEFAULT_MAX_CONCURRENT_ANSWERS = 3;

/**
 * File d'attente en mémoire : au plus `max` tâches à la fois, les suivantes
 * attendent leur tour dans l'ordre d'arrivée. Une place libérée passe
 * directement à la tâche suivante.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new Error("La limite de concurrence doit valoir au moins 1.");
  }

  get activeCount(): number {
    return this.active;
  }

  get waitingCount(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.max) this.active += 1;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}

/** `ASSISTANT_MAX_CONCURRENT_ANSWERS`, entre 1 et 20. */
export function resolveMaxConcurrentAnswers(env: NodeJS.ProcessEnv): number {
  const value = Number(env.ASSISTANT_MAX_CONCURRENT_ANSWERS);
  if (!env.ASSISTANT_MAX_CONCURRENT_ANSWERS?.trim() || !Number.isInteger(value)) return DEFAULT_MAX_CONCURRENT_ANSWERS;
  return Math.min(20, Math.max(1, value));
}
