import { inArray, sql } from "drizzle-orm";
import { profiles, type DbOrTx } from "@kemet/db";
import type { ProfileRow } from "./works.js";

export const RELATED_PEOPLE_SHOWN = 3;

export interface RelatedPeopleQuery {
  /** Tags et stack de l'élément affiché. */
  terms: string[];
  excludeWorkId: string | null;
  /** Auteurs de l'élément affiché : déjà sous les yeux. */
  excludeProfileIds: string[];
}

/**
 * Personnes qui ont publié ou cosigné un travail partageant au moins un tag ou
 * un élément de stack avec le sujet, classées par nombre de termes communs.
 * Aucun appel au modèle : c'est ce qu'un visiteur voit.
 */
export async function findRelatedPeople(
  db: DbOrTx,
  { terms, excludeWorkId, excludeProfileIds }: RelatedPeopleQuery,
): Promise<{ total: number; people: ProfileRow[] }> {
  const normalized = [...new Set(terms.map((term) => term.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return { total: 0, people: [] };
  const termArray = sql`array[${sql.join(
    normalized.map((term) => sql`${term}`),
    sql`, `,
  )}]::text[]`;
  const excludedArray =
    excludeProfileIds.length > 0
      ? sql`array[${sql.join(
          excludeProfileIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}]`
      : sql`array[]::uuid[]`;

  const rows = await db.execute<{ profile_id: string; total: number }>(sql`
    with matched as (
      select w.id, w.publisher_id, w.created_at,
        (select count(*) from unnest(${termArray}) as term
          where term in (select lower(x) from unnest(w.tags || w.stack) as x)) as shared
      from works w
      where w.deleted_at is null
        and (${excludeWorkId}::uuid is null or w.id <> ${excludeWorkId}::uuid)
    ),
    authors as (
      select m.publisher_id as profile_id, m.shared, m.created_at from matched m where m.shared > 0
      union all
      select a.profile_id, m.shared, m.created_at
      from matched m
      join work_authors a on a.work_id = m.id and a.status = 'accepted'
      where m.shared > 0
    ),
    ranked as (
      select a.profile_id, max(a.shared) as shared, max(a.created_at) as latest
      from authors a
      join profiles p on p.id = a.profile_id
      where not p.is_filler
        and p.suspended_at is null
        and p.deleted_at is null
        and a.profile_id <> all(${excludedArray})
      group by a.profile_id
    )
    select profile_id, (count(*) over ())::int as total
    from ranked
    order by shared desc, latest desc, profile_id
    limit ${RELATED_PEOPLE_SHOWN}
  `);
  if (rows.length === 0) return { total: 0, people: [] };

  const ids = rows.map((row) => row.profile_id);
  const found = await db.select().from(profiles).where(inArray(profiles.id, ids));
  const byId = new Map(found.map((profile) => [profile.id, profile]));
  return {
    total: rows[0]!.total,
    people: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
  };
}
