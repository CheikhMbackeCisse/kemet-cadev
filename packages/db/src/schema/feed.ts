import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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

export const postFormatEnum = pgEnum("post_format", ["astuce", "a_tester", "question"]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Un partage est un post ordinaire qui pointe vers l'original : pas de
    // table dédiée, conforme à la liste des quatre tables de ce lot dans
        // docs/CONTEXTE.md. Il disparaît avec son auteur ou avec l'original.
    sharedPostId: uuid("shared_post_id").references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    format: postFormatEnum("format"),
    testUrl: text("test_url"),
    testAsk: text("test_ask"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("posts_author_created_idx").on(table.authorId, table.createdAt),
    index("posts_shared_post_idx").on(table.sharedPostId),
    check(
      "posts_body_or_share",
      sql`length(${table.body}) > 0 or ${table.sharedPostId} is not null`,
    ),
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
    // Un seul "marqué comme solution" par post, sur les posts de format
    // Question (docs/CONTEXTE.md). Appliqué par setPostReplySolution
    // (apps/server/src/api/repositories/posts.ts), pas par un index partiel :
    // aucun autre index partiel n'existe encore dans ce schéma.
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
