import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { profiles, type Db } from "@kemet/db";
import { containsPattern } from "./like-pattern.js";

const ROLES_BY_KIND = {
  school: ["student"],
  company: ["developer", "hr", "entrepreneur"],
} as const;

/**
 * Noms déjà saisis par d'autres, les plus fréquents d'abord. Deux écritures
 * qui ne diffèrent que par la casse comptent ensemble ; la première dans
 * l'ordre binaire (majuscules d'abord) est proposée. Ces noms sont déjà
 * publics : ils s'affichent sur les profils.
 */
export async function listOrganizationSuggestions(
  db: Db,
  kind: keyof typeof ROLES_BY_KIND,
  query: string,
  limit: number,
): Promise<string[]> {
  const key = sql`lower(${profiles.organization})`;
  // Sans COLLATE "C", min() suit le classement de la base : en_US.utf8
  // (image postgres officielle) range "ept" avant "EPT".
  const name = sql<string>`min(${profiles.organization} collate "C")`;
  const rows = await db
    .select({ name })
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.organization),
        inArray(profiles.role, [...ROLES_BY_KIND[kind]]),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
        eq(profiles.isFiller, false),
        ...(query ? [sql`${profiles.organization} ilike ${containsPattern(query)}`] : []),
      ),
    )
    .groupBy(key)
    .orderBy(sql`count(*) desc`, name)
    .limit(limit);
  return rows.map((row) => row.name);
}
