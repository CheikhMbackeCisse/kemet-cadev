import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.js";
import { works } from "./works.js";

export const postFormatEnum = pgEnum("post_format", ["astuce", "a_tester", "question"]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Un partage est un post ordinaire qui pointe vers l'original, sans table
    // dédiée. Il disparaît avec son auteur ou avec l'original.
    sharedPostId: uuid("shared_post_id").references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    format: postFormatEnum("format"),
    testUrl: text("test_url"),
    testAsk: text("test_ask"),
    // Étiquette "Débutant", posée par l'auteur : alimente le filtre "Pour débuter".
    isBeginner: boolean("is_beginner").notNull().default(false),
    // Post publié automatiquement avec un travail : il renvoie vers lui.
    workId: uuid("work_id").references(() => works.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("posts_author_created_idx").on(table.authorId, table.createdAt),
    index("posts_shared_post_idx").on(table.sharedPostId),
    index("posts_work_idx").on(table.workId),
    // Pas de CHECK "texte ou image" : les images vivent dans une autre table.
    // La règle est appliquée par createPostSchema.
    // Écrit avec coalesce pour éviter le piège des CHECK Postgres : une
    // comparaison à NULL (format non renseigné) vaut NULL, pas faux, et un
    // CHECK qui vaut NULL est considéré respecté. Sans le coalesce, un post
    // sans format passerait un lien de démo sans jamais être refusé.
    check(
      "posts_test_fields_require_a_tester_format",
      sql`coalesce(${table.format} = 'a_tester', false) or (${table.testUrl} is null and ${table.testAsk} is null)`,
    ),
  ],
);

export const postAttachments = pgTable(
  "post_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nul tant que l'image n'est pas rattachée à un post publié.
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    originalName: text("original_name").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("post_attachments_post_idx").on(table.postId),
    index("post_attachments_author_idx").on(table.authorId),
  ],
);

export const postReplies = pgTable(
  "post_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // Une seule solution par post Question, garantie par setPostReplySolution.
    isSolution: boolean("is_solution").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("post_replies_post_created_idx").on(table.postId, table.createdAt)],
);

export const postReactions = pgTable(
  "post_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("post_reactions_post_profile_idx").on(table.postId, table.profileId)],
);

// Posts enregistrés pour plus tard. Visibles seulement par la personne qui
// les enregistre ; disparaissent avec le post ou le compte.
export const postBookmarks = pgTable(
  "post_bookmarks",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_bookmarks_profile_post_idx").on(table.profileId, table.postId),
    index("post_bookmarks_profile_created_idx").on(table.profileId, table.createdAt),
  ],
);

// Republication sans citation : une par personne et par post, annulable. Le
// post republié remonte dans le fil de qui suit la personne qui l'a republié.
export const postReposts = pgTable(
  "post_reposts",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("post_reposts_profile_post_idx").on(table.profileId, table.postId),
    index("post_reposts_profile_created_idx").on(table.profileId, table.createdAt),
    index("post_reposts_post_idx").on(table.postId),
  ],
);

export const postFeedback = pgTable(
  "post_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("post_feedback_post_author_idx").on(table.postId, table.authorId)],
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(profiles, { fields: [posts.authorId], references: [profiles.id] }),
  sharedPost: one(posts, {
    fields: [posts.sharedPostId],
    references: [posts.id],
    relationName: "sharedPost",
  }),
  shares: many(posts, { relationName: "sharedPost" }),
  replies: many(postReplies),
  reactions: many(postReactions),
  feedback: many(postFeedback),
  attachments: many(postAttachments),
  work: one(works, { fields: [posts.workId], references: [works.id] }),
}));

export const postAttachmentsRelations = relations(postAttachments, ({ one }) => ({
  post: one(posts, { fields: [postAttachments.postId], references: [posts.id] }),
  author: one(profiles, { fields: [postAttachments.authorId], references: [profiles.id] }),
}));

export const postRepliesRelations = relations(postReplies, ({ one }) => ({
  post: one(posts, { fields: [postReplies.postId], references: [posts.id] }),
  author: one(profiles, { fields: [postReplies.authorId], references: [profiles.id] }),
}));

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(posts, { fields: [postReactions.postId], references: [posts.id] }),
  profile: one(profiles, { fields: [postReactions.profileId], references: [profiles.id] }),
}));

export const postFeedbackRelations = relations(postFeedback, ({ one }) => ({
  post: one(posts, { fields: [postFeedback.postId], references: [posts.id] }),
  author: one(profiles, { fields: [postFeedback.authorId], references: [profiles.id] }),
}));
