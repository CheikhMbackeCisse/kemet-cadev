import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { profiles, type Db } from "@kemet/db";

const ROLES_BY_KIND = {
  school: ["student"],
  company: ["developer", "hr", "entrepreneur"],
} as const;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Noms déjà saisis par d'autres, les plus fréquents d'abord. Deux écritures
 * qui ne diffèrent que par la casse comptent ensemble ; la plus ancienne
 * dans l'ordre alphabétique est proposée. Ces noms sont déjà publics : ils
 * s'affichent sur les profils.
 */
export async function listOrganizationSuggestions(
  db: Db,
  kind: keyof typeof ROLES_BY_KIND,
  query: string,
  limit: number,
): Promise<string[]> {
  const key = sql`lower(${profiles.organization})`;
  const rows = await db
    .select({ name: sql<string>`min(${profiles.organization})` })
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.organization),
        inArray(profiles.role, [...ROLES_BY_KIND[kind]]),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
        eq(profiles.isFiller, false),
        ...(query ? [sql`${profiles.organization} ilike ${`%${escapeLike(query)}%`}`] : []),
      ),
    )
    .groupBy(key)
    .orderBy(sql`count(*) desc`, sql`min(${profiles.organization})`)
    .limit(limit);
  return rows.map((row) => row.name);
}
