import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

// Aide ponctuelle et collaboration durable partagent la table
// `help_requests`, plutôt que deux tables presque identiques.
export const helpRequestKindEnum = pgEnum("help_request_kind", ["help", "collaboration"]);
export const helpRequestStatusEnum = pgEnum("help_request_status", ["open", "closed"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "declined"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    pitch: text("pitch").notNull(),
    description: text("description").notNull().default(""),
    repoUrl: text("repo_url").notNull(),
    demoUrl: text("demo_url"),
    stack: text("stack").array().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("projects_owner_created_idx").on(table.ownerId, table.createdAt)],
);

export const helpRequests = pgTable(
  "help_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: helpRequestKindEnum("kind").notNull().default("help"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    stack: text("stack").array().notNull().default([]),
    status: helpRequestStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => [index("help_requests_project_created_idx").on(table.projectId, table.createdAt)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    helpRequestId: uuid("help_request_id")
      .notNull()
      .references(() => helpRequests.id, { onDelete: "cascade" }),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: applicationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
  },
  (table) => [
    // Une seule candidature par personne et par demande : la renvoyer ne
    // crée pas une deuxième ligne, voir insertApplication (repository).
    uniqueIndex("applications_help_request_applicant_idx").on(table.helpRequestId, table.applicantId),
    index("applications_help_request_created_idx").on(table.helpRequestId, table.createdAt),
  ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(profiles, { fields: [projects.ownerId], references: [profiles.id] }),
  helpRequests: many(helpRequests),
}));

export const helpRequestsRelations = relations(helpRequests, ({ one, many }) => ({
  project: one(projects, { fields: [helpRequests.projectId], references: [projects.id] }),
  author: one(profiles, { fields: [helpRequests.authorId], references: [profiles.id] }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  helpRequest: one(helpRequests, { fields: [applications.helpRequestId], references: [helpRequests.id] }),
  applicant: one(profiles, { fields: [applications.applicantId], references: [profiles.id] }),
}));
