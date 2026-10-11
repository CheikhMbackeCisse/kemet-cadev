import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  title: text("title"),
  bio: text("bio"),
  stack: text("stack").array().notNull().default([]),
  githubUrl: text("github_url"),
  openToOpportunities: boolean("open_to_opportunities").notNull().default(false),
  isDemo: boolean("is_demo").notNull().default(false),
  // Première brique d'un rôle admin sur la plateforme (lot 10, validation
  // des demandes de création de compétition). Aucune interface ne permet
  // encore de le changer : affecté directement en base, comme le parcours
  // vérifié avant son écran. Réutilisable par la modération (
  // lot 7 bis) quand elle sera posée.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
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
