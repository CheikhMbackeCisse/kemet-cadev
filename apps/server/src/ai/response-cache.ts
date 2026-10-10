import { createHash } from "node:crypto";
import Redis from "ioredis";

const DEFAULT_TTL_SECONDS = 60 * 60;
const KEY_PREFIX = "kemet:assistant-cache:";

export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

/**
 * Clé stable pour une question et un ensemble de skills retenus : deux
 * personnes qui posent la même question avec les mêmes skills obtiennent la
 * réponse déjà calculée plutôt que de consommer à nouveau le quota de
 * Gemini ou d'OpenRouter.
 */
export function buildCacheKey(question: string, skillIds: string[]): string {
  const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, " ");
  const sortedSkillIds = [...skillIds].sort();
  return createHash("sha256").update(JSON.stringify({ normalizedQuestion, sortedSkillIds })).digest("hex");
}

export class RedisResponseCache implements ResponseCache {
  private readonly client: Redis;

  constructor(valkeyUrl: string) {
    this.client = new Redis(valkeyUrl);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(KEY_PREFIX + key);
  }

  async set(key: string, value: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    await this.client.set(KEY_PREFIX + key, value, "EX", ttlSeconds);
  }

  async close(): Promise<void> {
    this.client.disconnect();
  }
}

export class InMemoryResponseCache implements ResponseCache {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}
