import { and, gte, inArray, ne, sql } from "drizzle-orm";
import { levelForPoints, type Level } from "@kemet/shared";
import type { DbOrTx } from "./client.js";
import { pointsLedger } from "./schema/index.js";

// Parcours vérifié : barème dans `credentialPoints` (points-rules.ts).
export const POINTS_PARCOURS_CAP = 1500;

export const POINTS_REGULARITE_CAP = 500;
export const POINTS_REGULARITE_WINDOW_DAYS = 90;
export const POINTS_REGULARITE_DAILY_BONUS = 5;

export type PointsSource = (typeof pointsLedger.$inferSelect)["source"];

// Tout ce qui n'est ni de l'entraide ni une démonstration relève du parcours,
// plafonné. La régularité n'a pas de source : elle se déduit des dates du
// registre.
const ENTRAIDE_SOURCES: ReadonlySet<PointsSource> = new Set([
  "post_reply_solution",
  "post_feedback_given",
  "assistant_skill_helpful",
  "project_help_confirmed",
  "competition_participation",
  "competition_victory",
]);

// Ni une vérification de parcours ni une ligne de démonstration ne sont une
// action de la personne : elles ne comptent pas comme jour actif.
const NOT_AN_ACTION: ReadonlyArray<PointsSource> = ["credential_verified", "demonstration"];

async function countActiveDaysByProfile(
  db: DbOrTx,
  profileIds: string[],
  windowDays: number,
): Promise<Map<string, number>> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ profileId: pointsLedger.profileId, createdAt: pointsLedger.createdAt })
    .from(pointsLedger)
    .where(
      and(
        inArray(pointsLedger.profileId, profileIds),
        gte(pointsLedger.createdAt, since),
        ...NOT_AN_ACTION.map((source) => ne(pointsLedger.source, source)),
      ),
    );
  const days = new Map<string, Set<string>>();
  for (const row of rows) {
    const profileDays = days.get(row.profileId) ?? new Set<string>();
    profileDays.add(row.createdAt.toISOString().slice(0, 10));
    days.set(row.profileId, profileDays);
  }
  return new Map([...days].map(([profileId, profileDays]) => [profileId, profileDays.size]));
}

export interface ProfilePoints {
  totalPoints: number;
  level: Level;
}

/**
 * Recalculé à chaque lecture, pour qu'un total s'explique toujours. La
 * régularité (+5 par jour actif sur 90 jours, plafond 500) se déduit des
 * dates du registre : un gain annulé corrige le bonus tout seul. Deux
 * requêtes quel que soit le nombre de profils, pour les listes.
 */
export async function computeProfilesPoints(
  db: DbOrTx,
  profileIds: string[],
): Promise<Map<string, ProfilePoints>> {
  const uniqueIds = [...new Set(profileIds)];
  const result = new Map<string, ProfilePoints>();
  if (uniqueIds.length === 0) return result;

  const bySource = await db
    .select({
      profileId: pointsLedger.profileId,
      source: pointsLedger.source,
      total: sql<number>`coalesce(sum(${pointsLedger.amount}), 0)::int`,
    })
    .from(pointsLedger)
    .where(inArray(pointsLedger.profileId, uniqueIds))
    .groupBy(pointsLedger.profileId, pointsLedger.source);
  const activeDays = await countActiveDaysByProfile(db, uniqueIds, POINTS_REGULARITE_WINDOW_DAYS);

  for (const profileId of uniqueIds) {
    let parcours = 0;
    let entraide = 0;
    let demonstration = 0;
    for (const row of bySource) {
      if (row.profileId !== profileId) continue;
      if (row.source === "demonstration") demonstration += row.total;
      else if (ENTRAIDE_SOURCES.has(row.source)) entraide += row.total;
      else parcours += row.total;
    }
    const regularite = Math.min(
      POINTS_REGULARITE_CAP,
      POINTS_REGULARITE_DAILY_BONUS * (activeDays.get(profileId) ?? 0),
    );
    const totalPoints =
      Math.min(parcours, POINTS_PARCOURS_CAP) + entraide + regularite + demonstration;
    result.set(profileId, { totalPoints, level: levelForPoints(totalPoints) });
  }
  return result;
}

/** Total et niveau d'un seul profil, même calcul que `computeProfilesPoints`. */
export async function computeProfilePoints(db: DbOrTx, profileId: string): Promise<ProfilePoints> {
  const points = await computeProfilesPoints(db, [profileId]);
  return points.get(profileId)!;
}
