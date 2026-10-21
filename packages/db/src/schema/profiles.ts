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
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  // Rôle (lot « parle-nous de toi »), facultatif : l'étape qui le propose
  // est skippable. title sert de champ libre pour la spécialité associée.
  role: profileRoleEnum("role"),
  title: text("title"),
  bio: text("bio"),
  stack: text("stack").array().notNull().default([]),
  githubUrl: text("github_url"),
  // URL ou chemin absolu d'une image d'avatar. Pas d'upload depuis
  // l'interface pour l'instant : seuls les comptes de démonstration en ont
  // une, posée directement en base par packages/db/src/seed.ts.
  avatarUrl: text("avatar_url"),
  openToOpportunities: boolean("open_to_opportunities").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  // Première brique d'un rôle admin sur la plateforme (lot 10, validation
  // des demandes de création de compétition), réutilisée par la modération
  // (lot 7 bis) pour réserver la file de signalements et le journal
  // d'audit. Aucune interface ne permet encore de le changer : affecté
  // directement en base, comme le parcours vérifié avant son écran.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  // Un compte suspendu (lot 7 bis) ne peut plus écrire (poster, réagir,
  // rejoindre...) mais garde l'accès en lecture, comme un visiteur : voir
  // requireOwnProfile dans chaque fichier de routes concerné.
  suspendedAt: timestamp("suspended_at"),
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
