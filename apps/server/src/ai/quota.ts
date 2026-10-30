import { and, gte, eq, count } from "drizzle-orm";
import { assistantInvocations, type Db } from "@kemet/db";
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

/**
 * Quota quotidien selon le niveau, calculé en comptant les invocations du
 * jour plutôt que stocké. `limitOverride` fixe la limite pour les tests.
 */
export async function checkDailyQuota(
  db: Db,
  profileId: string,
  limitOverride?: number,
): Promise<{ allowed: boolean; usedToday: number; limit: number }> {
  const limit = limitOverride ?? LEVEL_DAILY_QUOTA[(await computeProfilePoints(db, profileId)).level];
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ value: count() })
    .from(assistantInvocations)
    .where(and(eq(assistantInvocations.requestedBy, profileId), gte(assistantInvocations.createdAt, startOfDay)));
  const usedToday = row?.value ?? 0;
  return { allowed: usedToday < limit, usedToday, limit };
}
