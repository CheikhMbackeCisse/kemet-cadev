import { and, gte, eq, count } from "drizzle-orm";
import type Redis from "ioredis";
import { assistantInvocations, workMatchRequests, type Db } from "@kemet/db";
import type { Level } from "@kemet/shared";
import { computeProfilePoints } from "../api/repositories/points.js";

export const DEFAULT_DAILY_QUOTA = 30;
const ELEVATED_DAILY_QUOTA = 60;
const MAX_DAILY_QUOTA = 150;

// Seuls Scribe (plus élevé) et Légende (maximal) ont un quota propre :
// Artisan et Architecte restent au quota de base.
const LEVEL_DAILY_QUOTA: Record<Level, number> = {
  apprenti: DEFAULT_DAILY_QUOTA,
  artisan: DEFAULT_DAILY_QUOTA,
  scribe: ELEVATED_DAILY_QUOTA,
  architecte: ELEVATED_DAILY_QUOTA,
  legende: MAX_DAILY_QUOTA,
};

export interface QuotaCounter {
  /**
   * Compte un appel s'il reste du quota aujourd'hui ; sinon ne compte rien.
   * `countToday` donne le total tiré de la base, qui reste la référence.
   */
  tryConsume(
    profileId: string,
    limit: number,
    countToday: () => Promise<number>,
  ): Promise<{ allowed: boolean; usedToday: number }>;
  /** Rend un appel compté qui n'a finalement rien laissé en base. */
  release(profileId: string): Promise<void>;
}

/**
 * Compte seulement à partir de la base : deux appels simultanés lisent le
 * même total et passent tous les deux. Réservé aux tests, qui tournent sans
 * Valkey.
 */
export const databaseQuotaCounter: QuotaCounter = {
  async tryConsume(_profileId, limit, countToday) {
    const used = await countToday();
    return used < limit ? { allowed: true, usedToday: used + 1 } : { allowed: false, usedToday: used };
  },
  async release() {},
};

const QUOTA_KEY_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * Compteur atomique dans Valkey, une clé par personne et par jour UTC. Il
 * part du total de la base à son premier usage de la journée (redémarrage de
 * Valkey, déploiement en cours de journée), puis INCR tranche entre deux
 * appels simultanés.
 */
export class RedisQuotaCounter implements QuotaCounter {
  constructor(private readonly client: Redis) {}

  private key(profileId: string): string {
    return `assistant-quota:${profileId}:${new Date().toISOString().slice(0, 10)}`;
  }

  async release(profileId: string): Promise<void> {
    await this.client.decr(this.key(profileId));
  }

  async tryConsume(profileId: string, limit: number, countToday: () => Promise<number>) {
    const key = this.key(profileId);
    if (!(await this.client.exists(key))) {
      // NX : si deux appels arrivent ensemble, un seul pose le point de départ.
      await this.client.set(key, await countToday(), "EX", QUOTA_KEY_TTL_SECONDS, "NX");
    }
    const results = await this.client.multi().incr(key).expire(key, QUOTA_KEY_TTL_SECONDS, "NX").exec();
    const [incrError, used] = results?.[0] ?? [new Error("transaction annulée"), null];
    if (incrError) throw incrError;
    const usedToday = Number(used);
    if (usedToday <= limit) return { allowed: true, usedToday };
    await this.client.decr(key);
    return { allowed: false, usedToday: usedToday - 1 };
  }
}

/**
 * Quota quotidien selon le niveau : mentions de @kemet dans un salon ou sous
 * un post et appels de "Qui a travaillé sur ce sujet ?" confondus. Un appel
 * accepté est compté tout de suite. `limitOverride` fixe la limite pour les
 * tests.
 */
export async function checkDailyQuota(
  db: Db,
  profileId: string,
  limitOverride?: number,
  counter: QuotaCounter = databaseQuotaCounter,
): Promise<{ allowed: boolean; usedToday: number; limit: number }> {
  const limit = limitOverride ?? LEVEL_DAILY_QUOTA[(await computeProfilePoints(db, profileId)).level];
  const result = await counter.tryConsume(profileId, limit, () => countUsedToday(db, profileId));
  return { ...result, limit };
}

async function countUsedToday(db: Db, profileId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [[invocations], [matches]] = await Promise.all([
    db
      .select({ value: count() })
      .from(assistantInvocations)
      .where(
        and(
          eq(assistantInvocations.requestedBy, profileId),
          gte(assistantInvocations.createdAt, startOfDay),
        ),
      ),
    db
      .select({ value: count() })
      .from(workMatchRequests)
      .where(
        and(
          eq(workMatchRequests.requestedBy, profileId),
          gte(workMatchRequests.createdAt, startOfDay),
        ),
      ),
  ]);
  return (invocations?.value ?? 0) + (matches?.value ?? 0);
}
