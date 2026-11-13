import { relations, sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

export const opportunityKindEnum = pgEnum("opportunity_kind", ["job", "internship", "mission"]);
export const contractTypeEnum = pgEnum("contract_type", ["cdi", "cdd", "alternance", "stage", "freelance"]);

// Une seule table pour les trois types : leurs champs propres sont peu
// nombreux, et la contrainte de type garde chaque ligne cohérente. La clôture
// se lit sur la date limite, jamais stockée.
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    kind: opportunityKindEnum("kind").notNull(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    remote: boolean("remote").notNull().default(false),
    countryCode: text("country_code"),
    city: text("city"),
    domains: text("domains").array().notNull().default([]),
    description: text("description").notNull(),
    contractType: contractTypeEnum("contract_type"),
    startDate: date("start_date", { mode: "string" }),
    compensationFcfa: integer("compensation_fcfa"),
    budgetMinFcfa: integer("budget_min_fcfa"),
    budgetMaxFcfa: integer("budget_max_fcfa"),
    deadline: date("deadline", { mode: "string" }),
    criteria: text("criteria").array().notNull().default([]),
    // Offre d'une organisation : la personne qui l'a publiée en son nom, qui
    // reçoit les candidatures tant qu'elle gère la page.
    publishedById: uuid("published_by_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("opportunities_created_idx").on(table.createdAt),
    index("opportunities_author_idx").on(table.authorId),
    check("opportunities_location", sql`${table.remote} or ${table.countryCode} is not null`),
    check(
      "opportunities_kind_fields",
      sql`(${table.kind} = 'mission' and ${table.budgetMinFcfa} is not null and ${table.budgetMaxFcfa} is not null
          and ${table.budgetMinFcfa} <= ${table.budgetMaxFcfa} and ${table.deadline} is not null
          and ${table.contractType} is null and ${table.startDate} is null and ${table.compensationFcfa} is null)
        or (${table.kind} in ('job', 'internship') and ${table.contractType} is not null and ${table.startDate} is not null
          and ${table.budgetMinFcfa} is null and ${table.budgetMaxFcfa} is null)`,
    ),
  ],
);

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  author: one(profiles, { fields: [opportunities.authorId], references: [profiles.id] }),
}));
