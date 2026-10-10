import { and, gte, eq, count } from "drizzle-orm";
import { assistantInvocations, type Db } from "@kemet/db";

export const DEFAULT_DAILY_QUOTA = 30;

/**
 * Quota quotidien par utilisateur (voir docs/CONTEXTE.md, section niveaux).
 * Le niveau n'existe pas encore (lot 8, points et niveaux, n'est pas posé) :
 * la limite est la même pour tout le monde en attendant. Compter les
 * invocations plutôt que tenir un registre à part garde le quota dérivé,
 * dans le même esprit que les soldes jamais stockés.
 */
export async function checkDailyQuota(
  db: Db,
  profileId: string,
  limit = DEFAULT_DAILY_QUOTA,
): Promise<{ allowed: boolean; usedToday: number; limit: number }> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ value: count() })
    .from(assistantInvocations)
    .where(and(eq(assistantInvocations.requestedBy, profileId), gte(assistantInvocations.createdAt, startOfDay)));
  const usedToday = row?.value ?? 0;
  return { allowed: usedToday < limit, usedToday, limit };
}
