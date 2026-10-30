import { sql } from "drizzle-orm";
import type { Db } from "@kemet/db";

const DEFAULT_CANDIDATE_LIMIT = 20;

export interface SkillCandidate {
  id: string;
  slug: string;
  name: string;
  description: string;
}

/**
 * Présélectionne les skills pertinents parmi ceux que l'utilisateur a le
 * droit d'utiliser. Les étapes suivantes ne supposent rien de la méthode.
 */
export interface SkillRetriever {
  findCandidates(query: string, profileId: string, limit?: number): Promise<SkillCandidate[]>;
}

/**
 * Recherche plein texte sur `skills.search_vector` (french et english,
 * tenue à jour par trigger). Les droits sont filtrés dans la requête.
 */
export class FullTextRetriever implements SkillRetriever {
  constructor(private readonly db: Db) {}

  async findCandidates(
    query: string,
    profileId: string,
    limit = DEFAULT_CANDIDATE_LIMIT,
  ): Promise<SkillCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const rows = await this.db.execute<{ id: string; slug: string; name: string; description: string }>(sql`
      select s.id, s.slug, s.name, s.description
      from skills s
      where (
        plainto_tsquery('french', ${trimmed}) @@ s.search_vector
        or plainto_tsquery('english', ${trimmed}) @@ s.search_vector
      )
      and (
        s.visibility = 'public'
        or (s.visibility = 'private' and s.author_id = ${profileId})
        or (
          s.visibility = 'space'
          and s.space_id in (select space_id from space_members where profile_id = ${profileId})
        )
      )
      order by greatest(
        ts_rank(s.search_vector, plainto_tsquery('french', ${trimmed})),
        ts_rank(s.search_vector, plainto_tsquery('english', ${trimmed}))
      ) desc
      limit ${limit}
    `);

    return rows.map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description }));
  }
}
