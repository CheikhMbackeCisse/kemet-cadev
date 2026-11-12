import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizationTypeEnum, profiles } from "./profiles.js";

// Personnes qui publient au nom d'une organisation. La personne qui a
// référencé l'organisation en devient la première, à l'acceptation.
export const organizationManagers = pgTable(
  "organization_managers",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    managerId: uuid("manager_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.managerId] }),
    index("organization_managers_manager_idx").on(table.managerId),
  ],
);

export const organizationRequestStatusEnum = pgEnum("organization_request_status", [
  "pending",
  "accepted",
  "refused",
]);

// Demande de référencement, relue par un administrateur. Une demande
// refusée n'est jamais publique : son logo est effacé du disque au refus.
export const organizationRequests = pgTable(
  "organization_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    organizationType: organizationTypeEnum("organization_type").notNull(),
    country: text("country").notNull(),
    websiteUrl: text("website_url"),
    description: text("description"),
    logoStorageKey: text("logo_storage_key"),
    logoMimeType: text("logo_mime_type"),
    logoByteSize: bigint("logo_byte_size", { mode: "number" }),
    status: organizationRequestStatusEnum("status").notNull().default("pending"),
    organizationId: uuid("organization_id").references(() => profiles.id, { onDelete: "set null" }),
    decidedById: uuid("decided_by_id").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Une seule demande en attente par personne.
    uniqueIndex("organization_requests_one_pending_idx")
      .on(table.requesterId)
      .where(sql`${table.status} = 'pending'`),
    index("organization_requests_status_idx").on(table.status, table.createdAt),
  ],
);
