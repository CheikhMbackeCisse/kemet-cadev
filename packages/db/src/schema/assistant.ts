import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { channels, messages, spaces } from "./chat.js";
import { profiles } from "./profiles.js";

export const skillVisibilityEnum = pgEnum("skill_visibility", ["private", "space", "public"]);
export const assistantInvocationStatusEnum = pgEnum("assistant_invocation_status", [
  "pending",
  "streaming",
  "done",
  "failed",
]);
export const llmProviderNameEnum = pgEnum("llm_provider_name", ["gemini", "openrouter"]);

// Tenu à jour par un trigger plutôt qu'une colonne générée : deux
// configurations (french, english) pondérées par champ, illisibles en
// `generatedAlwaysAs`.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default([]),
    visibility: skillVisibilityEnum("visibility").notNull().default("public"),
    // Valeur de secours sans portée : le trigger `skills_search_vector_trigger`
    // (voir la migration) la recalcule avant chaque insertion ou mise à jour.
    searchVector: tsvector("search_vector")
      .notNull()
      .default(sql`''::tsvector`),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("skills_search_vector_idx").using("gin", table.searchVector),
    index("skills_author_idx").on(table.authorId),
    check(
      "skills_space_visibility_requires_space",
      sql`${table.visibility} <> 'space' or ${table.spaceId} is not null`,
    ),
  ],
);

export const skillFiles = pgTable(
  "skill_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("skill_files_skill_filename_idx").on(table.skillId, table.filename)],
);

export const skillRatings = pgTable(
  "skill_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("skill_ratings_skill_rater_idx").on(table.skillId, table.raterId),
    check("skill_ratings_stars_range", sql`${table.stars} between 1 and 5`),
  ],
);

export const assistantInvocations = pgTable(
  "assistant_invocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    triggerMessageId: uuid("trigger_message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    responseMessageId: uuid("response_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    skillIds: uuid("skill_ids").array().notNull().default([]),
    provider: llmProviderNameEnum("provider"),
    status: assistantInvocationStatusEnum("status").notNull().default("pending"),
    errorCode: text("error_code"),
    helpful: boolean("helpful"),
    // Réponse rejouée depuis un enregistrement (données de démonstration, ou
    // secours quand les deux fournisseurs sont saturés) : toujours affichée
    // comme telle, jamais comme une réponse générée en direct.
    recorded: boolean("recorded").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("assistant_invocations_requested_by_created_at_idx").on(table.requestedBy, table.createdAt),
    index("assistant_invocations_channel_idx").on(table.channelId),
  ],
);

export const workMatchSubjectEnum = pgEnum("work_match_subject", ["work", "project", "post"]);
export const workMatchModeEnum = pgEnum("work_match_mode", ["assistant", "recorded", "full_text"]);

// Une ligne par appel de "Qui a travaillé sur ce sujet ?". Elle compte dans
// le quota quotidien de l'assistant au même titre qu'une invocation dans un
// salon (voir apps/server/src/ai/quota.ts).
export const workMatchRequests = pgTable(
  "work_match_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subjectType: workMatchSubjectEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    mode: workMatchModeEnum("mode").notNull(),
    provider: llmProviderNameEnum("provider"),
    candidateCount: integer("candidate_count").notNull(),
    suggestionCount: integer("suggestion_count").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("work_match_requests_requested_by_created_idx").on(table.requestedBy, table.createdAt),
  ],
);

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  addedBy: uuid("added_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const skillsRelations = relations(skills, ({ one, many }) => ({
  author: one(profiles, { fields: [skills.authorId], references: [profiles.id] }),
  space: one(spaces, { fields: [skills.spaceId], references: [spaces.id] }),
  files: many(skillFiles),
  ratings: many(skillRatings),
}));

export const skillFilesRelations = relations(skillFiles, ({ one }) => ({
  skill: one(skills, { fields: [skillFiles.skillId], references: [skills.id] }),
}));

export const skillRatingsRelations = relations(skillRatings, ({ one }) => ({
  skill: one(skills, { fields: [skillRatings.skillId], references: [skills.id] }),
  rater: one(profiles, { fields: [skillRatings.raterId], references: [profiles.id] }),
}));

export const assistantInvocationsRelations = relations(assistantInvocations, ({ one }) => ({
  channel: one(channels, { fields: [assistantInvocations.channelId], references: [channels.id] }),
  triggerMessage: one(messages, {
    fields: [assistantInvocations.triggerMessageId],
    references: [messages.id],
  }),
  responseMessage: one(messages, {
    fields: [assistantInvocations.responseMessageId],
    references: [messages.id],
  }),
  requester: one(profiles, { fields: [assistantInvocations.requestedBy], references: [profiles.id] }),
}));

export const workMatchRequestsRelations = relations(workMatchRequests, ({ one }) => ({
  requester: one(profiles, { fields: [workMatchRequests.requestedBy], references: [profiles.id] }),
}));

export const mcpServersRelations = relations(mcpServers, ({ one }) => ({
  addedByProfile: one(profiles, { fields: [mcpServers.addedBy], references: [profiles.id] }),
}));
