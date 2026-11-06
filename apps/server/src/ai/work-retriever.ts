import { sql } from "drizzle-orm";
import type { Db } from "@kemet/db";

export const WORK_CANDIDATE_LIMIT = 20;
// Au-delà, le sujet n'apporte plus de mots utiles et la requête grossit pour rien.
const SUBJECT_TEXT_LIMIT = 2000;
// Avec des mots reliés par OU, presque tout travail partage un mot courant
// avec le sujet ("mobile", "terrain") : sous ce seuil, relatif au meilleur
// score, un travail n'est plus proposé.
const MIN_RELATIVE_RANK = 0.25;

export interface WorkCandidateQuery {
  /** Titre, texte, tags et stack de l'élément affiché. */
  text: string;
  /** La personne qui demande : ses propres travaux ne sont jamais proposés. */
  viewerProfileId: string;
  /** Le travail affiché, quand le sujet en est un. */
  excludeWorkId: string | null;
  limit?: number;
}

/**
 * Présélection des travaux proches d'un sujet. Les étapes suivantes ne
 * supposent rien de la méthode.
 */
export interface WorkRetriever {
  findCandidates(query: WorkCandidateQuery): Promise<string[]>;
}

/**
 * Recherche plein texte sur `works.search_vector`. Le sujet est un texte long :
 * ses mots sont reliés par OU plutôt que par ET (ce que ferait
 * `plainto_tsquery`), et le classement par `ts_rank` remonte les travaux qui
 * en partagent le plus. Un mot vide d'une langue passé par la configuration
 * de l'autre ("de", "the") est écarté : il ferait remonter presque tout.
 */
export class FullTextWorkRetriever implements WorkRetriever {
  constructor(private readonly db: Db) {}

  async findCandidates({
    text,
    viewerProfileId,
    excludeWorkId,
    limit = WORK_CANDIDATE_LIMIT,
  }: WorkCandidateQuery): Promise<string[]> {
    const subject = text.slice(0, SUBJECT_TEXT_LIMIT).trim();
    if (!subject) return [];

    const rows = await this.db.execute<{ id: string }>(sql`
      with lexemes as (
        select lexeme
        from unnest(tsvector_to_array(to_tsvector('french', ${subject}))) as lexeme
        where length(lexeme) > 1 and to_tsvector('english', lexeme) <> ''::tsvector
        union
        select lexeme
        from unnest(tsvector_to_array(to_tsvector('english', ${subject}))) as lexeme
        where length(lexeme) > 1 and to_tsvector('french', lexeme) <> ''::tsvector
      ),
      query as (
        select to_tsquery('simple', string_agg(quote_literal(lexeme), ' | ')) as q from lexemes
      ),
      ranked as (
        select w.id, w.created_at, ts_rank(w.search_vector, query.q) as rank
        from works w, query
        where query.q is not null
          and w.search_vector @@ query.q
          and w.deleted_at is null
          and (${excludeWorkId}::uuid is null or w.id <> ${excludeWorkId}::uuid)
          and w.publisher_id <> ${viewerProfileId}
          and not exists (
            select 1 from work_authors a
            where a.work_id = w.id and a.profile_id = ${viewerProfileId} and a.status = 'accepted'
          )
          and not exists (
            select 1 from profiles p where p.id = w.publisher_id and p.suspended_at is not null
          )
      )
      select id from ranked
      where rank >= ${MIN_RELATIVE_RANK} * (select max(rank) from ranked)
      order by rank desc, created_at desc
      limit ${limit}
    `);
    return rows.map((row) => row.id);
  }
}
