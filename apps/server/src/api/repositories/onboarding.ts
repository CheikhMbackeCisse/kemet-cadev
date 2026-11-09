import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { BEGINNERS_SPACE_ID, follows, profileBlocks, profiles, spaceMembers, spaces, type Db } from "@kemet/db";
import {
  INTEREST_KEYWORDS,
  isBeginnerAudience,
  interestSchema,
  intentSchema,
  ONBOARDING_PEOPLE_SUGGESTIONS,
  type Intent,
  type Interest,
  type UpdateOnboardingInput,
} from "@kemet/shared";
import { KEMET_ASSISTANT_PROFILE_ID } from "../../chat/kemet-assistant.js";

type ProfileRow = typeof profiles.$inferSelect;
type SpaceRow = typeof spaces.$inferSelect;

/** Espace toujours proposé à l'écran "Espaces à rejoindre", quels que soient les sujets choisis. */
export const ALWAYS_SUGGESTED_SPACE_SLUG = "cadev-2026";

const MAX_SPACE_SUGGESTIONS = 6;

export async function updateOnboarding(db: Db, profileId: string, input: UpdateOnboardingInput) {
  const [row] = await db
    .update(profiles)
    .set({
      ...(input.interests && { interests: [...new Set(input.interests)] }),
      ...(input.intents && { intents: [...new Set(input.intents)] }),
      ...(input.interestOther !== undefined && { interestOther: input.interestOther }),
      ...(input.roleOther !== undefined && { roleOther: input.roleOther }),
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

/** Intentions enregistrées, réduites à celles que le code connaît encore. */
export function knownIntents(values: readonly string[]): Intent[] {
  return values.flatMap((value) => {
    const parsed = intentSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Sujets enregistrés, réduits à ceux que le code connaît encore. */
export function knownInterests(values: readonly string[]): Interest[] {
  return values.flatMap((value) => {
    const parsed = interestSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
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

// Un sujet sans mot ("other") n'a pas de motif : une alternative vide
// trouverait n'importe quel texte.
const KEYWORD_PATTERNS = Object.fromEntries(
  Object.entries(INTEREST_KEYWORDS)
    .filter(([, keywords]) => keywords.length > 0)
    .map(([interest, keywords]) => [
      interest,
      new RegExp(`(^|[^a-z0-9])(${keywords.map(escapeRegExp).join("|")})($|[^a-z0-9])`),
    ]),
) as Partial<Record<Interest, RegExp>>;

/** Nombre de sujets dont au moins un mot apparaît dans le texte, comparé sans accent ni casse. */
export function countMatchedInterests(text: string, interests: readonly Interest[]): number {
  const haystack = normalize(text);
  return interests.filter((interest) => KEYWORD_PATTERNS[interest]?.test(haystack)).length;
}

/**
 * Espaces proposés : CADEV 2026 toujours, "Débuter en informatique" en tête
 * pour un débutant (isBeginnerAudience), puis les espaces qui parlent des
 * sujets choisis.
 */
export async function suggestSpaces(
  db: Db,
  profileId: string,
  interests: readonly Interest[],
  options: { beginner?: boolean } = {},
) {
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
  const beginners = options.beginner ? scored.find((row) => row.space.id === BEGINNERS_SPACE_ID) : undefined;
  const pinned = [beginners, always].filter((row): row is (typeof scored)[number] => row !== undefined);
  const others = scored
    .filter((row) => !pinned.includes(row) && row.score > 0)
    // À égalité, le plus récent d'abord : un nouvel espace a besoin d'être vu.
    .sort((a, b) => b.score - a.score || b.space.createdAt.getTime() - a.space.createdAt.getTime());
  return [...pinned, ...others].slice(0, MAX_SPACE_SUGGESTIONS) as {
    space: SpaceRow;
    role: (typeof spaceMembers.$inferSelect)["role"] | null;
    score: number;
  }[];
}

// Mêmes accents retirés en SQL qu'en JavaScript par normalize(), pour les
// lettres que l'on rencontre dans une spécialité ou une bio en français.
const ACCENTED = "àâäáãéèêëíìîïóòôöõúùûüçñ";
const UNACCENTED = "aaaaaeeeeiiiiooooouuuucn";

function personTextSql() {
  return sql`translate(lower(concat_ws(' ', ${profiles.title}, ${profiles.bio}, array_to_string(${profiles.stack}, ' '))), ${ACCENTED}, ${UNACCENTED})`;
}

function personScoreSql(viewer: ProfileRow) {
  const text = personTextSql();
  const interestPoints = knownInterests(viewer.interests).flatMap((interest) => {
    const pattern = KEYWORD_PATTERNS[interest];
    return pattern ? [sql`(case when ${text} ~ ${pattern.source} then 2 else 0 end)`] : [];
  });
  const countryPoints =
    viewer.country === "" ? [] : [sql`(case when ${profiles.country} = ${viewer.country} then 1 else 0 end)`];
  // Toujours une expression : un ORDER BY sur le seul littéral 0, sans sujet ni
  // pays, serait lu par PostgreSQL comme un numéro de colonne et refusé.
  return sql<number>`${sql.join([sql`0::int`, ...interestPoints, ...countryPoints], sql` + `)}`;
}

/**
 * Cinq personnes à suivre. Pour un débutant, celles qui ont activé "Aide les
 * débutants" passent d'abord. Ensuite deux points par sujet commun trouvé dans la
 * spécialité, la bio ou la stack, un de plus pour le même pays, puis les
 * plus suivies. Aucun appel à l'assistant, qui n'est jamais proposé, pas
 * plus qu'un compte suspendu ou supprimé, ni un blocage dans un sens ou l'autre. Classé par PostgreSQL : la base
 * de démonstration compte plus de douze mille profils.
 */
export async function suggestPeople(db: Db, viewer: ProfileRow) {
  const score = personScoreSql(viewer);
  const helpersFirst = isBeginnerAudience(viewer)
    ? [desc(profiles.helpsBeginners)]
    : [];
  const followerCount = sql<number>`(select count(*) from ${follows} where ${follows.followeeId} = ${profiles.id})`;
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
        eq(profiles.isFiller, false),
        sql`not exists (select 1 from ${profileBlocks} where (${profileBlocks.blockerId} = ${viewer.id} and ${profileBlocks.blockedId} = ${profiles.id}) or (${profileBlocks.blockerId} = ${profiles.id} and ${profileBlocks.blockedId} = ${viewer.id}))`,
      ),
    )
    .orderBy(...helpersFirst, desc(score), desc(followerCount), asc(profiles.createdAt))
    .limit(ONBOARDING_PEOPLE_SUGGESTIONS);
  return rows.map((row) => ({ profile: row.profile, isFollowed: row.followId !== null }));
}
