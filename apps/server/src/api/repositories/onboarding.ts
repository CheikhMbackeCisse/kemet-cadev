import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { follows, profiles, spaceMembers, spaces, type Db } from "@kemet/db";
import {
  INTEREST_KEYWORDS,
  ONBOARDING_PEOPLE_SUGGESTIONS,
  type Interest,
  type UpdateOnboardingInput,
} from "@kemet/shared";
import { KEMET_ASSISTANT_PROFILE_ID } from "../../chat/kemet-assistant.js";

type ProfileRow = typeof profiles.$inferSelect;
type SpaceRow = typeof spaces.$inferSelect;

/** Espace toujours proposé à l'écran "Espaces à rejoindre", quels que soient les sujets choisis. */
export const ALWAYS_SUGGESTED_SPACE_SLUG = "cadev-2026";

const MAX_SPACE_SUGGESTIONS = 6;
// Les suggestions sont classées en mémoire : au-delà, les profils les plus
// récents ne sont pas examinés. Large pour le volume visé avant la soumission.
const MAX_PEOPLE_CANDIDATES = 1000;

export async function updateOnboarding(db: Db, profileId: string, input: UpdateOnboardingInput) {
  const [row] = await db
    .update(profiles)
    .set({
      ...(input.interests && { interests: [...new Set(input.interests)] }),
      ...(input.step && { onboardingStep: input.step }),
      // Une fois terminé, le parcours le reste : la première date est gardée.
      ...(input.completed && {
        onboardingCompletedAt: sql`coalesce(${profiles.onboardingCompletedAt}, now())`,
      }),
    })
    .where(eq(profiles.id, profileId))
    .returning();
  return row!;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KEYWORD_PATTERNS = Object.fromEntries(
  Object.entries(INTEREST_KEYWORDS).map(([interest, keywords]) => [
    interest,
    new RegExp(`(^|[^a-z0-9])(${keywords.map(escapeRegExp).join("|")})($|[^a-z0-9])`),
  ]),
) as Record<Interest, RegExp>;

/** Nombre de sujets dont au moins un mot apparaît dans le texte, comparé sans accent ni casse. */
export function countMatchedInterests(text: string, interests: readonly Interest[]): number {
  const haystack = normalize(text);
  return interests.filter((interest) => KEYWORD_PATTERNS[interest].test(haystack)).length;
}

export async function suggestSpaces(db: Db, profileId: string, interests: readonly Interest[]) {
  const rows = await db
    .select({ space: spaces, role: spaceMembers.role })
    .from(spaces)
    .leftJoin(spaceMembers, and(eq(spaceMembers.spaceId, spaces.id), eq(spaceMembers.profileId, profileId)))
    .where(and(eq(spaces.visibility, "public"), eq(spaces.kind, "community"), isNull(spaces.archivedAt)));

  const scored = rows.map((row) => ({
    space: row.space,
    role: row.role,
    score: countMatchedInterests(`${row.space.name} ${row.space.description ?? ""}`, interests),
  }));
  const always = scored.find((row) => row.space.slug === ALWAYS_SUGGESTED_SPACE_SLUG);
  const others = scored
    .filter((row) => row !== always && row.score > 0)
    .sort((a, b) => b.score - a.score || a.space.createdAt.getTime() - b.space.createdAt.getTime());
  return [...(always ? [always] : []), ...others].slice(0, MAX_SPACE_SUGGESTIONS) as {
    space: SpaceRow;
    role: (typeof spaceMembers.$inferSelect)["role"] | null;
    score: number;
  }[];
}

function personText(profile: ProfileRow): string {
  return [profile.title, profile.bio, ...profile.stack].filter(Boolean).join(" ");
}

/**
 * Cinq personnes à suivre : un point par sujet commun trouvé dans la
 * spécialité, la bio ou la stack, un de plus pour le même pays. Aucun appel à
 * l'assistant, qui n'est jamais proposé, pas plus qu'un compte suspendu ou supprimé.
 */
export async function suggestPeople(db: Db, viewer: ProfileRow) {
  const rows = await db
    .select({ profile: profiles, followId: follows.id })
    .from(profiles)
    .leftJoin(follows, and(eq(follows.followeeId, profiles.id), eq(follows.followerId, viewer.id)))
    .where(
      and(
        ne(profiles.id, viewer.id),
        ne(profiles.id, KEMET_ASSISTANT_PROFILE_ID),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
      ),
    )
    .limit(MAX_PEOPLE_CANDIDATES);

  const interests = viewer.interests as Interest[];
  return rows
    .map((row) => ({
      profile: row.profile,
      isFollowed: row.followId !== null,
      score:
        2 * countMatchedInterests(personText(row.profile), interests) +
        (viewer.country !== "" && row.profile.country === viewer.country ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.profile.createdAt.getTime() - b.profile.createdAt.getTime())
    .slice(0, ONBOARDING_PEOPLE_SUGGESTIONS);
}
