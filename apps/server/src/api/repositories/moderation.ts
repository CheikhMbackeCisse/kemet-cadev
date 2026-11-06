import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { moderationActions, reports, type Db } from "@kemet/db";
import type { ModerationAction, ReportTarget } from "@kemet/shared";
import { findChannelById, findMessageById, findProfileById, findSpaceById, findSpaceMembership } from "./chat.js";
import { findPostById } from "./posts.js";
import { findWorkById } from "./works.js";

const TARGET_SUMMARY_LENGTH = 140;

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export interface ReportTargetInfo {
  authorId: string;
  summary: string;
}

/**
 * Pour créer un signalement : `null` si la cible n'existe plus ou si
 * `viewerProfileId` ne peut pas la voir (même règle que
 * `requireChannelAccess`). Sinon, signaler un identifiant deviné révélerait
 * un extrait d'un espace privé. L'auteur sert à refuser l'auto-signalement.
 */
export async function resolveReportTarget(
  db: Db,
  targetType: ReportTarget,
  targetId: string,
  viewerProfileId: string,
): Promise<ReportTargetInfo | null> {
  if (targetType === "message") {
    const message = await findMessageById(db, targetId);
    if (!message || message.deletedAt) return null;
    const channel = await findChannelById(db, message.channelId);
    if (!channel) return null;
    const space = await findSpaceById(db, channel.spaceId);
    if (!space) return null;
    if (space.visibility === "private" && !(await findSpaceMembership(db, space.id, viewerProfileId))) return null;
    return { authorId: message.authorId, summary: truncate(message.body, TARGET_SUMMARY_LENGTH) };
  }
  if (targetType === "post") {
    const post = await findPostById(db, targetId);
    if (!post || post.deletedAt) return null;
    return { authorId: post.authorId, summary: truncate(post.body, TARGET_SUMMARY_LENGTH) };
  }
  if (targetType === "work") {
    const work = await findWorkById(db, targetId);
    if (!work || work.deletedAt) return null;
    return { authorId: work.publisherId, summary: truncate(work.title, TARGET_SUMMARY_LENGTH) };
  }
  const profile = await findProfileById(db, targetId);
  if (!profile) return null;
  return { authorId: profile.id, summary: `@${profile.handle}` };
}

/**
 * Résumé pour la file et le journal, réservés aux admins. Ignore la
 * visibilité par espace : un signalement dans un espace privé doit pouvoir
 * être jugé. Accepte une cible déjà masquée ou supprimée.
 */
export async function describeReportTarget(db: Db, targetType: ReportTarget, targetId: string): Promise<string> {
  if (targetType === "message") {
    const message = await findMessageById(db, targetId);
    if (!message) return "(message introuvable)";
    return message.deletedAt ? "(message masqué)" : truncate(message.body, TARGET_SUMMARY_LENGTH);
  }
  if (targetType === "post") {
    const post = await findPostById(db, targetId);
    if (!post) return "(post introuvable)";
    return post.deletedAt ? "(post masqué)" : truncate(post.body, TARGET_SUMMARY_LENGTH);
  }
  if (targetType === "work") {
    const work = await findWorkById(db, targetId);
    if (!work) return "(travail introuvable)";
    return work.deletedAt ? "(travail masqué)" : truncate(work.title, TARGET_SUMMARY_LENGTH);
  }
  const profile = await findProfileById(db, targetId);
  return profile ? `@${profile.handle}` : "(profil introuvable)";
}

export async function insertReport(
  db: Db,
  input: { reporterId: string; targetType: ReportTarget; targetId: string; reason: string },
) {
  const [report] = await db
    .insert(reports)
    .values(input)
    .onConflictDoNothing({ target: [reports.reporterId, reports.targetType, reports.targetId] })
    .returning();
  return report ?? null;
}

export async function findReportById(db: Db, reportId: string) {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId));
  return report ?? null;
}

function toPage<T extends { createdAt: Date }>(rows: T[], limit: number, order: "asc" | "desc") {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
  return { items, nextCursor, order };
}

// Ordre croissant : la file se traite dans l'ordre d'arrivée, le plus
// ancien signalement non traité en premier.
export async function listPendingReports(db: Db, cursor: string | undefined, limit: number) {
  const pending = eq(reports.status, "pending");
  const condition = cursor ? and(pending, gt(reports.createdAt, new Date(cursor))) : pending;
  const rows = await db.select().from(reports).where(condition).orderBy(asc(reports.createdAt)).limit(limit + 1);
  return toPage(rows, limit, "asc");
}

/**
 * Referme tous les signalements en attente sur une même cible (y compris
 * celui qui a déclenché l'action) : évite qu'un contenu déjà masqué ou un
 * compte déjà suspendu laisse des doublons dans la file.
 */
export async function resolvePendingReportsForTarget(
  db: Db,
  targetType: ReportTarget,
  targetId: string,
  resolvedBy: string,
) {
  await db
    .update(reports)
    .set({ status: "resolved", resolvedAt: new Date(), resolvedBy })
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "pending")));
}

export async function dismissReport(db: Db, reportId: string, resolvedBy: string) {
  const [report] = await db
    .update(reports)
    .set({ status: "dismissed", resolvedAt: new Date(), resolvedBy })
    .where(eq(reports.id, reportId))
    .returning();
  return report!;
}

export async function insertModerationAction(
  db: Db,
  input: {
    actorId: string;
    action: ModerationAction;
    targetType: ReportTarget;
    targetId: string;
    reportId: string | null;
    reason: string | null;
  },
) {
  const [entry] = await db.insert(moderationActions).values(input).returning();
  return entry!;
}

// Ordre décroissant : un journal d'audit se lit des événements les plus
// récents vers les plus anciens.
export async function listModerationLog(db: Db, cursor: string | undefined, limit: number) {
  const condition = cursor ? lt(moderationActions.createdAt, new Date(cursor)) : undefined;
  const rows = await db
    .select()
    .from(moderationActions)
    .where(condition)
    .orderBy(desc(moderationActions.createdAt))
    .limit(limit + 1);
  return toPage(rows, limit, "desc");
}
