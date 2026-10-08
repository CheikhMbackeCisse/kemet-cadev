import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";

export const spaceVisibilityEnum = pgEnum("space_visibility", ["public", "private"]);
export const spaceMemberRoleEnum = pgEnum("space_member_role", ["owner", "admin", "member"]);

export const spaces = pgTable("spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  visibility: spaceVisibilityEnum("visibility").notNull().default("public"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const spaceMembers = pgTable(
  "space_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: spaceMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("space_members_space_profile_idx").on(table.spaceId, table.profileId)],
);

export const spaceInvites = pgTable(
  "space_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "space_invites_use_count_within_max",
      sql`${table.maxUses} is null or ${table.useCount} <= ${table.maxUses}`,
    ),
  ],
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("channels_space_slug_idx").on(table.spaceId, table.slug)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    parentMessageId: uuid("parent_message_id").references((): AnyPgColumn => messages.id, {
      onDelete: "cascade",
    }),
    clientId: text("client_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [uniqueIndex("messages_author_client_idx").on(table.authorId, table.clientId)],
);

export const messageMentions = pgTable(
  "message_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("message_mentions_message_profile_idx").on(table.messageId, table.profileId)],
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("message_reactions_message_profile_emoji_idx").on(
      table.messageId,
      table.profileId,
      table.emoji,
    ),
  ],
);

export const readStates = pgTable(
  "read_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lastReadMessageId: uuid("last_read_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("read_states_channel_profile_idx").on(table.channelId, table.profileId)],
);

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  creator: one(profiles, { fields: [spaces.createdBy], references: [profiles.id] }),
  members: many(spaceMembers),
  channels: many(channels),
  invites: many(spaceInvites),
}));

export const spaceMembersRelations = relations(spaceMembers, ({ one }) => ({
  space: one(spaces, { fields: [spaceMembers.spaceId], references: [spaces.id] }),
  profile: one(profiles, { fields: [spaceMembers.profileId], references: [profiles.id] }),
}));

export const spaceInvitesRelations = relations(spaceInvites, ({ one }) => ({
  space: one(spaces, { fields: [spaceInvites.spaceId], references: [spaces.id] }),
  createdByProfile: one(profiles, { fields: [spaceInvites.createdBy], references: [profiles.id] }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  space: one(spaces, { fields: [channels.spaceId], references: [spaces.id] }),
  messages: many(messages),
  readStates: many(readStates),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  channel: one(channels, { fields: [messages.channelId], references: [channels.id] }),
  author: one(profiles, { fields: [messages.authorId], references: [profiles.id] }),
  parent: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id],
    relationName: "parent",
  }),
  replies: many(messages, { relationName: "parent" }),
  mentions: many(messageMentions),
  reactions: many(messageReactions),
}));

export const messageMentionsRelations = relations(messageMentions, ({ one }) => ({
  message: one(messages, { fields: [messageMentions.messageId], references: [messages.id] }),
  profile: one(profiles, { fields: [messageMentions.profileId], references: [profiles.id] }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, { fields: [messageReactions.messageId], references: [messages.id] }),
  profile: one(profiles, { fields: [messageReactions.profileId], references: [profiles.id] }),
}));

export const readStatesRelations = relations(readStates, ({ one }) => ({
  channel: one(channels, { fields: [readStates.channelId], references: [channels.id] }),
  profile: one(profiles, { fields: [readStates.profileId], references: [profiles.id] }),
  lastReadMessage: one(messages, {
    fields: [readStates.lastReadMessageId],
    references: [messages.id],
  }),
}));
