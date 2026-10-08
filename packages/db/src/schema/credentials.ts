import { relations } from "drizzle-orm";
import { date, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

export const credentialTypeEnum = pgEnum("credential_type", ["job", "education", "internship"]);
export const credentialStatusEnum = pgEnum("credential_status", ["declared", "verified"]);

export const credentials = pgTable("credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  type: credentialTypeEnum("type").notNull(),
  organization: text("organization").notNull(),
  title: text("title").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: credentialStatusEnum("status").notNull().default("declared"),
  verificationMethod: text("verification_method"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const credentialsRelations = relations(credentials, ({ one }) => ({
  profile: one(profiles, {
    fields: [credentials.profileId],
    references: [profiles.id],
  }),
}));
