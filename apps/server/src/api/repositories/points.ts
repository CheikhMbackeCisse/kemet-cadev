import { and, eq, gte, sql } from "drizzle-orm";
import { pointsLedger, type DbOrTx } from "@kemet/db";
import { levelForPoints, type Level } from "@kemet/shared";

export const POINTS_POST_REPLY_SOLUTION = 10;
export const POINTS_POST_FEEDBACK_GIVEN = 10;
export const POINTS_ASSISTANT_SKILL_HELPFUL = 5;
export const POINTS_PROJECT_HELP_CONFIRMED = 20;
export const POINTS_COMPETITION_PARTICIPATION = 10;
// Classement : 1er, 2e, 3e (docs/CONTEXTE.md). Un rang au-delà n'est pas
// récompensé.
export const POINTS_COMPETITION_VICTORY_BY_RANK: ReadonlyArray<number> = [200, 100, 50];

// Valeur non spécifiée par docs/CONTEXTE.md ("plafond de points qu'une même
// personne peut te donner par jour") : choisie arbitrairement, à ajuster
// si elle se révèle trop basse ou trop haute en usage réel.
export const POINTS_DAILY_GIVER_CAP = 50;

// Réservé au parcours vérifié (lot 3) : aucune action ne verse encore dans
// cette catégorie, faute d'écran de vérification des crédentials.
export const POINTS_PARCOURS_CAP = 1500;

export const POINTS_REGULARITE_CAP = 500;
export const POINTS_REGULARITE_WINDOW_DAYS = 90;
export const POINTS_REGULARITE_DAILY_BONUS = 5;

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

type PointsLedgerRow = typeof pointsLedger.$inferSelect;
export type PointsSource = PointsLedgerRow["source"];

// Toutes les sources actuelles relèvent de l'entraide (docs/CONTEXTE.md),
// sans plafond. Le parcours vérifié et la régularité n'ont pas de source
// dans le registre : le premier attend l'écran de vérification des
// crédentials, la seconde se calcule directement à partir des dates des
// lignes existantes (voir countActiveDays ci-dessous), jamais stockée.
const ENTRAIDE_SOURCES: ReadonlySet<PointsSource> = new Set([
  "post_reply_solution",
  "post_feedback_given",
  "assistant_skill_helpful",
  "project_help_confirmed",
  "competition_participation",
  "competition_victory",
]);

export interface AwardPointsInput {
  profileId: string;
  source: PointsSource;
  sourceId: string;
  amount: number;
  givenByProfileId?: string | null;
}

/**
 * Ajoute une ligne au registre, jamais ne la modifie. Idempotent par
 * construction : un deuxième appel avec le même (source, sourceId,
 * profileId) ne redonne rien, grâce à l'index unique de la table — même
 * mécanisme que les réactions et les retours structurés du fil (lot 7).
 * Refuse de se donner des points à soi-même et applique le plafond
 * quotidien par donneur en réduisant le montant plutôt qu'en le refusant
 * en bloc, pour ne pas perdre les points encore disponibles ce jour-là.
 *
 * La lecture du plafond puis l'écriture se font sous un verrou consultatif
 * Postgres posé sur le binôme (donneur, receveur) : sans lui, deux requêtes
 * concurrentes avec des sourceId distincts (donc jamais bloquées par
 * l'index unique) peuvent chacune lire le même total avant qu'aucune n'ait
 * écrit, et dépasser le plafond — exactement le scénario que deux comptes
 * complices scripteraient pour le contourner.
 */
export async function awardPoints(db: DbOrTx, input: AwardPointsInput): Promise<void> {
  if (input.amount <= 0) return;
  if (input.givenByProfileId && input.givenByProfileId === input.profileId) return;

  if (!input.givenByProfileId) {
    await insertLedgerRow(db, input.profileId, input.source, input.sourceId, input.amount, null);
    return;
  }

  const giverId = input.givenByProfileId;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${giverId} || ${input.profileId}, 0))`);
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
    .onConflictDoNothing({ target: [pointsLedger.source, pointsLedger.sourceId, pointsLedger.profileId] });
}

async function sumGivenToday(db: DbOrTx, giverProfileId: string, receiverProfileId: string): Promise<number> {
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

async function countActiveDays(db: DbOrTx, profileId: string, windowDays: number): Promise<number> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ createdAt: pointsLedger.createdAt })
    .from(pointsLedger)
    .where(and(eq(pointsLedger.profileId, profileId), gte(pointsLedger.createdAt, since)));
  const days = new Set(rows.map((row) => row.createdAt.toISOString().slice(0, 10)));
  return days.size;
}

export interface ProfilePoints {
  totalPoints: number;
  level: Level;
}

/**
 * Jamais stocké : recalculé à chaque lecture à partir du registre, comme le
 * recommande docs/CONTEXTE.md pour pouvoir toujours expliquer un total.
 * La régularité (+5 par jour avec une action utile, sur 90 jours, plafond
 * 500) se déduit des dates déjà présentes dans le registre plutôt que
 * d'ajouter une ligne par jour : si une ligne de gain est un jour annulée,
 * le bonus de régularité se corrige tout seul au prochain calcul.
 */
export async function computeProfilePoints(db: DbOrTx, profileId: string): Promise<ProfilePoints> {
  const bySource = await db
    .select({ source: pointsLedger.source, total: sql<number>`coalesce(sum(${pointsLedger.amount}), 0)::int` })
    .from(pointsLedger)
    .where(eq(pointsLedger.profileId, profileId))
    .groupBy(pointsLedger.source);

  let parcours = 0;
  let entraide = 0;
  for (const row of bySource) {
    if (ENTRAIDE_SOURCES.has(row.source)) entraide += row.total;
    else parcours += row.total;
  }

  const activeDays = await countActiveDays(db, profileId, POINTS_REGULARITE_WINDOW_DAYS);
  const regularite = Math.min(POINTS_REGULARITE_CAP, POINTS_REGULARITE_DAILY_BONUS * activeDays);

  const totalPoints = Math.min(parcours, POINTS_PARCOURS_CAP) + entraide + regularite;
  return { totalPoints, level: levelForPoints(totalPoints) };
}

/**
 * Montant d'un gain déclenché par un "Utile" (docs/CONTEXTE.md : "vaut plus
 * s'il vient d'un niveau élevé, et presque rien s'il vient d'un compte
 * récent"). `giver` est la personne qui clique sur "Utile", jamais celle qui
 * reçoit les points.
 */
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
