import { and, eq, gte, isNull, ne, sql } from "drizzle-orm";
import {
  computeProfilePoints,
  computeProfilesPoints,
  pointsLedger,
  profiles,
  type DbOrTx,
  type PointsSource,
} from "@kemet/db";
import type { Level } from "@kemet/shared";

export {
  POINTS_ASSISTANT_SKILL_HELPFUL,
  POINTS_COMPETITION_PARTICIPATION,
  POINTS_COMPETITION_VICTORY_BY_RANK,
  POINTS_POST_FEEDBACK_GIVEN,
  POINTS_POST_REPLY_SOLUTION,
  POINTS_PROJECT_HELP_CONFIRMED,
  POINTS_PARCOURS_CAP,
  POINTS_REGULARITE_CAP,
  POINTS_REGULARITE_DAILY_BONUS,
  POINTS_REGULARITE_WINDOW_DAYS,
  computeProfilePoints,
  computeProfilesPoints,
  type PointsSource,
  type ProfilePoints,
} from "@kemet/db";

// Plafond quotidien de points qu'une même personne peut donner : valeur arbitraire.
export const POINTS_DAILY_GIVER_CAP = 50;

// "Presque rien si compte récent" (docs/CONTEXTE.md) est traduit ici par
// rien du tout avant ce seuil, pour rester simple à expliquer et à tester.
export const UTILE_RECENCY_THRESHOLD_DAYS = 7;

// "Un Utile vaut plus s'il vient d'un niveau élevé" : seuls Architecte et
// Légende sont distingués, les niveaux d'entrée n'apportent pas de bonus.
export const UTILE_LEVEL_MULTIPLIER: Record<Level, number> = {
  apprenti: 1,
  artisan: 1,
  scribe: 1,
  architecte: 1.5,
  legende: 2,
};

export interface AwardPointsInput {
  profileId: string;
  source: PointsSource;
  sourceId: string;
  amount: number;
  givenByProfileId?: string | null;
}

/**
 * Ajoute une ligne au registre, jamais ne la modifie. Idempotent grâce à
 * l'index unique (source, sourceId, profileId). Refuse les points donnés à
 * soi-même ; au-delà du plafond quotidien, le montant est réduit plutôt
 * que refusé.
 *
 * Plafond lu puis écrit sous un verrou consultatif sur (donneur, receveur) :
 * deux comptes complices pourraient sinon le dépasser par des requêtes
 * simultanées.
 */
export async function awardPoints(db: DbOrTx, input: AwardPointsInput): Promise<void> {
  if (input.amount <= 0) return;
  if (input.givenByProfileId && input.givenByProfileId === input.profileId) return;
  // Une organisation n'a ni points ni niveau : rien n'entre au registre pour elle.
  const [recipient] = await db
    .select({ kind: profiles.kind })
    .from(profiles)
    .where(eq(profiles.id, input.profileId));
  if (recipient?.kind === "organization") return;

  if (!input.givenByProfileId) {
    await insertLedgerRow(db, input.profileId, input.source, input.sourceId, input.amount, null);
    return;
  }

  const giverId = input.givenByProfileId;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${giverId} || ${input.profileId}, 0))`,
    );
    const givenToday = await sumGivenToday(tx, giverId, input.profileId);
    const headroom = POINTS_DAILY_GIVER_CAP - givenToday;
    if (headroom <= 0) return;
    const amount = Math.min(input.amount, headroom);
    await insertLedgerRow(tx, input.profileId, input.source, input.sourceId, amount, giverId);
  });
}

async function insertLedgerRow(
  db: DbOrTx,
  profileId: string,
  source: PointsSource,
  sourceId: string,
  amount: number,
  givenByProfileId: string | null,
): Promise<void> {
  await db
    .insert(pointsLedger)
    .values({ profileId, source, sourceId, amount, givenByProfileId })
    .onConflictDoNothing({
      target: [pointsLedger.source, pointsLedger.sourceId, pointsLedger.profileId],
    });
}

async function sumGivenToday(
  db: DbOrTx,
  giverProfileId: string,
  receiverProfileId: string,
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${pointsLedger.amount}), 0)::int` })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.givenByProfileId, giverProfileId),
        eq(pointsLedger.profileId, receiverProfileId),
        gte(pointsLedger.createdAt, startOfDay),
      ),
    );
  return row?.total ?? 0;
}

/** Niveau de chaque profil, pour l'afficher à côté des noms. */
export async function computeLevels(db: DbOrTx, profileIds: string[]): Promise<Map<string, Level>> {
  const points = await computeProfilesPoints(db, profileIds);
  return new Map([...points].map(([profileId, entry]) => [profileId, entry.level]));
}

/** Montant d'un "Utile" selon qui le donne (`giver`) : son niveau et l'âge de son compte. */
export async function computeUtileAwardAmount(
  db: DbOrTx,
  baseAmount: number,
  giver: { id: string; createdAt: Date },
): Promise<number> {
  const accountAgeDays = (Date.now() - giver.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (accountAgeDays < UTILE_RECENCY_THRESHOLD_DAYS) return 0;
  const { level } = await computeProfilePoints(db, giver.id);
  return Math.max(1, Math.round(baseAmount * UTILE_LEVEL_MULTIPLIER[level]));
}

/**
 * Nombre de membres à chaque niveau, calculé comme le niveau de chacun : à
 * partir du registre. Un profil sans aucune ligne au registre est Apprenti.
 * Ni l'assistant, ni une organisation, ni un compte supprimé ne comptent.
 */
export async function countMembersByLevel(
  db: DbOrTx,
  excludedProfileId: string,
): Promise<Record<Level, number>> {
  const counts: Record<Level, number> = {
    apprenti: 0,
    artisan: 0,
    scribe: 0,
    architecte: 0,
    legende: 0,
  };
  const [members] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        isNull(profiles.deletedAt),
        eq(profiles.kind, "person"),
        ne(profiles.id, excludedProfileId),
      ),
    );
  const withPoints = await db
    .selectDistinct({ profileId: pointsLedger.profileId })
    .from(pointsLedger)
    .innerJoin(profiles, eq(profiles.id, pointsLedger.profileId))
    .where(
      and(
        isNull(profiles.deletedAt),
        eq(profiles.kind, "person"),
        ne(profiles.id, excludedProfileId),
      ),
    );
  const points = await computeProfilesPoints(
    db,
    withPoints.map((row) => row.profileId),
  );
  for (const entry of points.values()) counts[entry.level] += 1;
  counts.apprenti += (members?.total ?? 0) - points.size;
  return counts;
}
