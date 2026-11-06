import { relations, sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";
import { works } from "./works.js";

/**
 * `pending` : la conversation est arrivée dans les "Demandes" de la personne,
 * qui ne l'a pas encore acceptée. `left` : demande refusée ou conversation
 * quittée, la personne n'y a plus accès.
 */
export const conversationMemberStatusEnum = pgEnum("conversation_member_status", ["accepted", "pending", "left"]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Les deux identifiants de profil triés, pour une conversation à deux
    // seulement : l'unicité garantit qu'écrire à quelqu'un rouvre toujours la
    // même conversation, même en cas de double clic simultané.
    directKey: text("direct_key").unique(),
    // Groupe ouvert par "Écrire à l'équipe en privé" : ses membres sont la
    // personne qui l'ouvre et les auteurs du travail, une fois par personne.
    // Annoté : works importe chat, qui importe ce fichier.
    workId: uuid("work_id").references((): AnyPgColumn => works.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("conversations_work_creator_idx").on(table.workId, table.createdBy)],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: conversationMemberStatusEnum("status").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => [
    uniqueIndex("conversation_members_conversation_profile_idx").on(table.conversationId, table.profileId),
    index("conversation_members_profile_idx").on(table.profileId, table.status),
  ],
);

export const profileBlocks = pgTable(
  "profile_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("profile_blocks_blocker_blocked_idx").on(table.blockerId, table.blockedId),
    index("profile_blocks_blocked_idx").on(table.blockedId),
    check("profile_blocks_no_self_block", sql`${table.blockerId} != ${table.blockedId}`),
  ],
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(profiles, { fields: [conversations.createdBy], references: [profiles.id] }),
  work: one(works, { fields: [conversations.workId], references: [works.id] }),
  members: many(conversationMembers),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMembers.conversationId],
    references: [conversations.id],
  }),
  profile: one(profiles, { fields: [conversationMembers.profileId], references: [profiles.id] }),
}));

export const profileBlocksRelations = relations(profileBlocks, ({ one }) => ({
  blocker: one(profiles, { fields: [profileBlocks.blockerId], references: [profiles.id], relationName: "blocker" }),
  blocked: one(profiles, { fields: [profileBlocks.blockedId], references: [profiles.id], relationName: "blocked" }),
}));
