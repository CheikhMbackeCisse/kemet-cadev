import type { moderationActions, reports } from "@kemet/db";
import type { ModerationActionEntry, Report } from "@kemet/shared";

type ReportRow = typeof reports.$inferSelect;
type ModerationActionRow = typeof moderationActions.$inferSelect;

export function serializeReport(row: ReportRow, reporterHandle: string, targetSummary: string): Report {
  return {
    id: row.id,
    reporterHandle,
    targetType: row.targetType,
    targetId: row.targetId,
    targetSummary,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeModerationActionEntry(
  row: ModerationActionRow,
  actorHandle: string,
  targetSummary: string,
): ModerationActionEntry {
  return {
    id: row.id,
    actorHandle,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    targetSummary,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
