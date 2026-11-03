import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const profileRoleEnum = pgEnum("profile_role", [
  "developer",
  "designer",
  "hr",
  "student",
  "project_manager",
  "other",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Vide une fois le compte supprimé : le profil reste, anonymisé, pour que
  // ses contenus et ceux qui y répondent restent lisibles (ADR 0023).
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  // Facultatif, l'étape qui le propose se passe. title porte la spécialité.
  role: profileRoleEnum("role"),
  title: text("title"),
  bio: text("bio"),
  stack: text("stack").array().notNull().default([]),
  githubUrl: text("github_url"),
  // Jamais accepté du client : seul le seed en pose un.
  avatarUrl: text("avatar_url"),
  openToOpportunities: boolean("open_to_opportunities").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  // Validation des compétitions et modération. Attribué seulement par
  // `pnpm db:promote-admin`, jamais par l'interface ni par le seed.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  // Un compte suspendu garde la lecture, perd l'écriture : vérifié par
  // requireOwnProfile dans chaque module de routes.
  suspendedAt: timestamp("suspended_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(user, {
    fields: [profiles.userId],
    references: [user.id],
  }),
}));
