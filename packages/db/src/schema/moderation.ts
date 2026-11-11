import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

export const reportTargetEnum = pgEnum("report_target", [
  "message",
  "post",
  "profile",
  "work",
  "conversation",
  "opportunity",
]);
export const reportStatusEnum = pgEnum("report_status", ["pending", "resolved", "dismissed"]);
export const moderationActionEnum = pgEnum("moderation_action", [
  "content_hidden",
  "account_suspended",
  "account_reinstated",
  "report_dismissed",
]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetType: reportTargetEnum("target_type").notNull(),
    // Pas de clé étrangère : la cible est polymorphe (message, post,
    // profil ou travail). L'existence est vérifiée côté route à la création, jamais en
    // base.
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    // Pour une conversation signalée : la personne visée, fixée au moment du
    // signalement plutôt que recalculée quand la modération décide.
    reportedProfileId: uuid("reported_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    // Pour une conversation : la modération ne lit que les messages écrits
    // avant cette date (signalement, ou départ de qui signale).
    excerptUntil: timestamp("excerpt_until"),
    status: reportStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => profiles.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("reports_reporter_target_idx").on(table.reporterId, table.targetType, table.targetId),
    index("reports_status_created_idx").on(table.status, table.createdAt),
    index("reports_target_idx").on(table.targetType, table.targetId),
  ],
);

// Journal d'audit en ajout seul : jamais modifié ni supprimé.
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    action: moderationActionEnum("action").notNull(),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    // Nul pour une action directe sans report d'origine (réintégration
    // décidée depuis le profil plutôt que depuis la file de signalements).
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("moderation_actions_target_created_idx").on(table.targetType, table.targetId, table.createdAt)],
);

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(profiles, { fields: [reports.reporterId], references: [profiles.id] }),
  resolvedByProfile: one(profiles, { fields: [reports.resolvedBy], references: [profiles.id] }),
}));

export const moderationActionsRelations = relations(moderationActions, ({ one }) => ({
  actor: one(profiles, { fields: [moderationActions.actorId], references: [profiles.id] }),
  report: one(reports, { fields: [moderationActions.reportId], references: [reports.id] }),
}));
