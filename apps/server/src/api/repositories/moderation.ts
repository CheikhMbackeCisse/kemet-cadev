import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { moderationActions, reports, type Db } from "@kemet/db";
import type { ModerationAction, ReportTarget } from "@kemet/shared";
import { findMessageById, findProfileById } from "./chat.js";
import {
  findConversationById,
  findConversationChannel,
  findConversationMember,
  findLatestOtherAuthor,
  listConversationMembers,
  listRecentConversationMessages,
} from "./conversations.js";
import { canAccessChannel } from "../../realtime/access.js";
import { findPostById } from "./posts.js";
import { findWorkById } from "./works.js";

const TARGET_SUMMARY_LENGTH = 140;
const REPORTED_CONVERSATION_EXCERPT = 10;

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export interface ReportTargetInfo {
  authorId: string;
  summary: string;
  /** Conversation seulement : messages lisibles par la modération jusqu'à cette date. */
  excerptUntil?: Date;
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
    if (!(await canAccessChannel(db, viewerProfileId, message.channelId))) return null;
    return { authorId: message.authorId, summary: truncate(message.body, TARGET_SUMMARY_LENGTH) };
  }
  if (targetType === "conversation") {
    // Une conversation quittée reste signalable (refuser une demande puis la
    // signaler est le cas courant), mais seulement pour ce que la personne a
    // pu lire : rien d'écrit après son départ.
    const member = await findConversationMember(db, targetId, viewerProfileId);
    if (!member) return null;
    const excerptUntil = member.status === "left" && member.respondedAt ? member.respondedAt : new Date();
    const reportedId = await findReportedConversationMember(db, targetId, viewerProfileId, excerptUntil);
    if (!reportedId) return null;
    // Qui signale ne reçoit que les participants : l'extrait est pour la modération.
    return { authorId: reportedId, summary: await describeConversation(db, targetId, null), excerptUntil };
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
export async function describeReportTarget(
  db: Db,
  targetType: ReportTarget,
  targetId: string,
  excerptUntil: Date | null = null,
): Promise<string> {
  if (targetType === "conversation") return describeConversation(db, targetId, excerptUntil);
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
  input: {
    reporterId: string;
    targetType: ReportTarget;
    targetId: string;
    reason: string;
    reportedProfileId?: string | null;
    excerptUntil?: Date | null;
  },
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

/**
 * Qui est signalé avec une conversation : l'autre personne dans une
 * conversation à deux ; dans un groupe, la dernière personne à y avoir écrit
 * avant `before` en dehors de qui signale, ou à défaut celle qui l'a créé.
 * Calculé une fois, au signalement, et gardé dans `reports.reported_profile_id`.
 */
export async function findReportedConversationMember(
  db: Db,
  conversationId: string,
  reporterId: string,
  before: Date,
) {
  const conversation = await findConversationById(db, conversationId);
  if (!conversation) return null;
  if (conversation.directKey) {
    const members = await listConversationMembers(db, [conversationId]);
    return members.find((entry) => entry.member.profileId !== reporterId)?.member.profileId ?? null;
  }
  const channel = await findConversationChannel(db, conversationId);
  const latest = await findLatestOtherAuthor(db, channel.id, reporterId, before);
  if (latest) return latest;
  return conversation.createdBy !== reporterId ? conversation.createdBy : null;
}

/**
 * Participants, puis, pour la file de modération, les derniers messages
 * écrits avant `excerptUntil` : la modération lit ce que la personne a choisi
 * de signaler, rien de ce qui a été écrit après. Sans date (réponse à qui
 * signale, journal de modération), les participants seulement.
 */
async function describeConversation(db: Db, conversationId: string, excerptUntil: Date | null): Promise<string> {
  const members = await listConversationMembers(db, [conversationId]);
  if (members.length === 0) return "(conversation introuvable)";
  const participants = members.map((entry) => `@${entry.profile.handle}`).join(", ");
  if (!excerptUntil) return `Conversation privée : ${participants}`;
  const channel = await findConversationChannel(db, conversationId);
  const excerpt = await listRecentConversationMessages(db, channel.id, excerptUntil, REPORTED_CONVERSATION_EXCERPT);
  const lines = excerpt.map(({ message, handle }) =>
    message.deletedAt ? `@${handle} : (message masqué)` : `@${handle} : ${truncate(message.body, TARGET_SUMMARY_LENGTH)}`,
  );
  return [`Conversation privée : ${participants}`, ...lines].join("\n");
}
