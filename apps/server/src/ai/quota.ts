import { and, gte, eq, count } from "drizzle-orm";
import { assistantInvocations, type Db } from "@kemet/db";
import type { Level } from "@kemet/shared";
import { computeProfilePoints } from "../api/repositories/points.js";

export const DEFAULT_DAILY_QUOTA = 30;
const ELEVATED_DAILY_QUOTA = 60;
const MAX_DAILY_QUOTA = 150;

// Valeurs non chiffrées par docs/CONTEXTE.md, qui ne fixe que Scribe
// ("quota d'IA plus élevé") et Légende ("quota d'IA maximal") : Artisan et
// Architecte restent au quota de base, à ajuster si besoin.
const LEVEL_DAILY_QUOTA: Record<Level, number> = {
  apprenti: DEFAULT_DAILY_QUOTA,
  artisan: DEFAULT_DAILY_QUOTA,
  scribe: ELEVATED_DAILY_QUOTA,
  architecte: ELEVATED_DAILY_QUOTA,
  legende: MAX_DAILY_QUOTA,
};

/**
 * Quota quotidien par utilisateur, selon son niveau (docs/CONTEXTE.md,
 * section niveaux), maintenant que le lot 8 (points et niveaux) est posé.
 * `limitOverride` sert aux tests, qui ont besoin d'une limite fixe pour
 * rester déterministes. Compter les invocations plutôt que tenir un
 * registre à part garde l'usage dérivé, dans le même esprit que les soldes
 * jamais stockés.
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
