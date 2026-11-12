import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { channels, spaceMembers, spaces, type Db } from "@kemet/db";
import { INTEREST_KEYWORDS, type Interest } from "@kemet/shared";
import { countSpaceMembersBatch } from "./chat.js";
import { mentionsAnyInterest, normalize } from "./onboarding.js";

type SpaceRow = typeof spaces.$inferSelect;
type SpaceMemberRole = typeof spaceMembers.$inferSelect.role;

// Les espaces publics se comptent en dizaines : les comparer en mémoire,
// sans accent, coûte moins qu'une extension unaccent en base. Au-delà de
// cette borne, les plus récents seulement sont cherchés.
const CANDIDATE_LIMIT = 500;

const SCORE = { name: 3, description: 2, channel: 1, topic: 1 } as const;

// Au-delà, les mots suivants sont ignorés : chacun coûte un passage sur
// tous les candidats.
const MAX_TOKENS = 8;

export interface SpaceSearchHit {
  space: SpaceRow;
  role: SpaceMemberRole | null;
  memberCount: number;
}

interface Candidate {
  space: SpaceRow;
  name: string;
  description: string;
  channelNames: string;
  /** Nom, description et salons d'un seul tenant, normalisés, pour les mots des sujets. */
  fullText: string;
}

/** Sujets dont un mot ressemble au mot cherché : "paiements" mène à la fintech. */
function topicsFor(token: string): Interest[] {
  return (Object.entries(INTEREST_KEYWORDS) as [Interest, readonly string[]][])
    .filter(([, keywords]) =>
      keywords.some(
        (keyword) =>
          keyword === token ||
          (token.length >= 4 && (keyword.startsWith(token) || token.startsWith(keyword))),
      ),
    )
    .map(([interest]) => interest);
}

function scoreToken(candidate: Candidate, token: string, topics: Interest[]): number {
  if (candidate.name.includes(token)) return SCORE.name;
  if (candidate.description.includes(token)) return SCORE.description;
  if (candidate.channelNames.includes(token)) return SCORE.channel;
  if (topics.length > 0 && mentionsAnyInterest(candidate.fullText, topics)) return SCORE.topic;
  return 0;
}

/**
 * Espaces publics dont le nom, la description, les salons ou les sujets
 * correspondent à chaque mot cherché. Jamais un espace privé, archivé ou
 * système, même pour l'un de ses membres.
 */
export async function searchPublicSpaces(
  db: Db,
  viewerProfileId: string | null,
  query: string,
  limit: number,
): Promise<SpaceSearchHit[]> {
  const tokens = normalize(query).split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS);
  if (tokens.length === 0) return [];

  const rows = await db
    .select({
      space: spaces,
      channelNames: sql<string>`coalesce(string_agg(${channels.name}, ' '), '')`,
    })
    .from(spaces)
    .leftJoin(channels, eq(channels.spaceId, spaces.id))
    .where(
      and(eq(spaces.visibility, "public"), eq(spaces.kind, "community"), isNull(spaces.archivedAt)),
    )
    .groupBy(spaces.id)
    .orderBy(desc(spaces.createdAt))
    .limit(CANDIDATE_LIMIT);

  const tokenTopics = tokens.map((token) => ({ token, topics: topicsFor(token) }));
  const scored = rows
    .map((row) => {
      const name = normalize(row.space.name);
      const description = normalize(row.space.description ?? "");
      const channelNames = normalize(row.channelNames);
      const candidate: Candidate = {
        space: row.space,
        name,
        description,
        channelNames,
        fullText: `${name} ${description} ${channelNames}`,
      };
      const scores = tokenTopics.map(({ token, topics }) => scoreToken(candidate, token, topics));
      const score = scores.every((value) => value > 0)
        ? scores.reduce((sum, value) => sum + value, 0)
        : 0;
      return { space: row.space, score };
    })
    .filter((match) => match.score > 0);
  // À score égal, l'espace le plus peuplé d'abord.
  const memberCounts = await countSpaceMembersBatch(
    db,
    scored.map((match) => match.space.id),
  );
  const count = (id: string) => memberCounts.get(id) ?? 0;
  const matches = scored
    .sort(
      (first, second) =>
        second.score - first.score || count(second.space.id) - count(first.space.id),
    )
    .slice(0, limit);

  const roles =
    viewerProfileId && matches.length > 0
      ? await db
          .select({ spaceId: spaceMembers.spaceId, role: spaceMembers.role })
          .from(spaceMembers)
          .where(
            and(
              eq(spaceMembers.profileId, viewerProfileId),
              inArray(
                spaceMembers.spaceId,
                matches.map((match) => match.space.id),
              ),
            ),
          )
      : [];
  const roleBySpace = new Map(roles.map((row) => [row.spaceId, row.role]));
  return matches.map((match) => ({
    space: match.space,
    role: roleBySpace.get(match.space.id) ?? null,
    memberCount: count(match.space.id),
  }));
}
