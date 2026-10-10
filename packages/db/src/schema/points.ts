import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

// Chaque lot qui attribue des points ajoute sa propre valeur ici au moment où
// il est codé : le parcours vérifié (lot 3, pas encore
// d'écran de vérification), l'aide confirmée sur un projet (lot 9) et les
// résultats de compétition (lot 10) n'existent pas encore.
export const pointsSourceEnum = pgEnum("points_source", [
  "post_reply_solution",
  "post_feedback_given",
  "assistant_skill_helpful",
]);

export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    source: pointsSourceEnum("source").notNull(),
    // Identifiant de la ligne à l'origine du gain (réponse, retour, invocation
    // de l'assistant) : permet de retrouver pourquoi des points ont été
    // donnés, et empêche d'en redonner deux fois pour le même événement.
    sourceId: uuid("source_id").notNull(),
    amount: integer("amount").notNull(),
    // Nulle pour un gain déclenché par sa propre action (retour structuré) ;
    // renseignée quand une autre personne est à l'origine du gain (solution
    // marquée, réponse de l'assistant jugée utile), pour appliquer le
    // plafond quotidien par donneur (docs/CONTEXTE.md, section niveaux).
    givenByProfileId: uuid("given_by_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("points_ledger_source_dedup_idx").on(table.source, table.sourceId, table.profileId),
    index("points_ledger_profile_created_idx").on(table.profileId, table.createdAt),
    index("points_ledger_giver_created_idx").on(table.givenByProfileId, table.profileId, table.createdAt),
  ],
);

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
  profile: one(profiles, { fields: [pointsLedger.profileId], references: [profiles.id] }),
  givenBy: one(profiles, { fields: [pointsLedger.givenByProfileId], references: [profiles.id] }),
}));
