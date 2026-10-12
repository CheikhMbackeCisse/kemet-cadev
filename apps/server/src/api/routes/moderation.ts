import type { FastifyInstance } from "fastify";
import { createReportSchema, paginationQuerySchema, resolveReportSchema } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import {
  describeReportTarget,
  dismissReport,
  findReportById,
  insertModerationAction,
  insertReport,
  listModerationLog,
  listPendingReports,
  resolvePendingReportsForTarget,
  resolveReportTarget,
} from "../repositories/moderation.js";
import { findProfileByHandle, findProfileByUserId, reinstateProfile, suspendProfile } from "../repositories/profiles.js";
import { findProfileById, softDeleteMessage } from "../repositories/chat.js";
import { softDeletePost } from "../repositories/posts.js";
import { serializeModerationActionEntry, serializeReport } from "../moderation-serializers.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import type { ChatAppDeps } from "../app.js";

const MAX_REPORTS_PER_MINUTE = 20;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de signaler un contenu.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireAdmin(db: ChatAppDeps["db"], userId: string) {
  const profile = await requireOwnProfile(db, userId);
  if (!profile.isPlatformAdmin) throw forbidden("Réservé aux administrateurs.");
  return profile;
}

export function registerModerationRoutes(app: FastifyInstance, { db, auth, antiSpamConfig }: ChatAppDeps): void {
  app.post(
    "/api/reports",
    { config: { rateLimit: { max: antiSpamMax(db, auth, antiSpamConfig, MAX_REPORTS_PER_MINUTE), timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = createReportSchema.parse(request.body);
      const target = await resolveReportTarget(db, input.targetType, input.targetId, profile.id);
      if (!target) throw notFound("Ce contenu n'existe plus.");
      if (target.authorId === profile.id) throw badRequest("Impossible de se signaler soi-même.");
      const report = await insertReport(db, {
        reporterId: profile.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      });
      if (!report) throw conflict("Vous avez déjà signalé ce contenu.");
      return { report: serializeReport(report, profile.handle, target.summary) };
    },
  );

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/api/reports", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireAdmin(db, userId);
    const query = paginationQuerySchema.parse(request.query);
    const page = await listPendingReports(db, query.cursor, query.limit);
    const items = await Promise.all(
      page.items.map(async (row) => {
        const [reporter, summary] = await Promise.all([
          findProfileById(db, row.reporterId),
          describeReportTarget(db, row.targetType, row.targetId),
        ]);
        return serializeReport(row, reporter!.handle, summary);
      }),
    );
    return { items, nextCursor: page.nextCursor };
  });

  app.put<{ Params: { id: string } }>(
    "/api/reports/:id/resolve",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const admin = await requireAdmin(db, userId);
      const report = await findReportById(db, request.params.id);
      if (!report) throw notFound("Ce signalement n'existe pas.");
      if (report.status !== "pending") throw conflict("Ce signalement a déjà été traité.");
      const input = resolveReportSchema.parse(request.body);

      const contentTargets = report.targetType === "message" || report.targetType === "post";
      if (input.action === "hide" && !contentTargets) {
        throw badRequest("Seul un message ou un post peut être masqué.");
      }
      if (input.action === "suspend" && report.targetType !== "profile") {
        throw badRequest("Seul un profil peut être suspendu.");
      }

      if (input.action === "dismiss") {
        const resolved = await dismissReport(db, report.id, admin.id);
        await insertModerationAction(db, {
          actorId: admin.id,
          action: "report_dismissed",
          targetType: report.targetType,
          targetId: report.targetId,
          reportId: report.id,
          reason: input.reason ?? null,
        });
        const summary = await describeReportTarget(db, resolved.targetType, resolved.targetId);
        return { report: serializeReport(resolved, (await findProfileById(db, resolved.reporterId))!.handle, summary) };
      }

      if (input.action === "hide") {
        if (report.targetType === "message") await softDeleteMessage(db, report.targetId);
        else await softDeletePost(db, report.targetId);
        await resolvePendingReportsForTarget(db, report.targetType, report.targetId, admin.id);
        await insertModerationAction(db, {
          actorId: admin.id,
          action: "content_hidden",
          targetType: report.targetType,
          targetId: report.targetId,
          reportId: report.id,
          reason: input.reason ?? null,
        });
      } else {
        await suspendProfile(db, report.targetId);
        await resolvePendingReportsForTarget(db, report.targetType, report.targetId, admin.id);
        await insertModerationAction(db, {
          actorId: admin.id,
          action: "account_suspended",
          targetType: report.targetType,
          targetId: report.targetId,
          reportId: report.id,
          reason: input.reason ?? null,
        });
      }

      const updated = await findReportById(db, report.id);
      const summary = await describeReportTarget(db, updated!.targetType, updated!.targetId);
      return { report: serializeReport(updated!, (await findProfileById(db, updated!.reporterId))!.handle, summary) };
    },
  );

  app.post<{ Params: { handle: string } }>(
    "/api/profiles/:handle/reinstate",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const admin = await requireAdmin(db, userId);
      const target = await findProfileByHandle(db, request.params.handle);
      if (!target) throw notFound("Ce profil n'existe pas.");
      if (!target.suspendedAt) throw conflict("Ce compte n'est pas suspendu.");
      await reinstateProfile(db, target.id);
      await insertModerationAction(db, {
        actorId: admin.id,
        action: "account_reinstated",
        targetType: "profile",
        targetId: target.id,
        reportId: null,
        reason: null,
      });
      return { reinstated: true };
    },
  );

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/api/moderation/log", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireAdmin(db, userId);
    const query = paginationQuerySchema.parse(request.query);
    const page = await listModerationLog(db, query.cursor, query.limit);
    const items = await Promise.all(
      page.items.map(async (row) => {
        const [actor, summary] = await Promise.all([
          findProfileById(db, row.actorId),
          describeReportTarget(db, row.targetType, row.targetId),
        ]);
        return serializeModerationActionEntry(row, actor!.handle, summary);
      }),
    );
    return { items, nextCursor: page.nextCursor };
  });
}
