import { sql, type AnyColumn } from "drizzle-orm";

/**
 * Exclut un contenu écrit par un figurant du seed. Table et colonnes écrites
 * en toutes lettres : dans une requête sur une seule table, Drizzle ne
 * qualifie pas les colonnes, et la sous-requête les confondrait.
 */
export function notWrittenByFiller(authorColumn: AnyColumn) {
  return sql`${authorColumn} not in (select "profiles"."id" from "profiles" where "profiles"."is_filler")`;
}
