import { relations, sql } from "drizzle-orm";
import {
  bigint,
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
import { channels } from "./chat.js";
import { profiles } from "./profiles.js";

export const workTypeEnum = pgEnum("work_type", [
  "class_project",
  "internship",
  "thesis_research",
  "application",
  "article",
  "other",
]);
export const workStatusEnum = pgEnum("work_status", ["completed", "in_progress"]);
export const workAuthorStatusEnum = pgEnum("work_author_status", [
  "pending",
  "accepted",
  "declined",
]);
export const workLinkTypeEnum = pgEnum("work_link_type", [
  "github",
  "gitlab",
  "drive",
  "site",
  "video",
  "article",
  "other",
]);

// Même choix que `skills.search_vector` : tenu à jour par un trigger (voir la
// migration), deux configurations pondérées par champ.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const works = pgTable(
  "works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publisherId: uuid("publisher_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    type: workTypeEnum("type").notNull(),
    status: workStatusEnum("status").notNull().default("completed"),
    summary: text("summary").notNull(),
    tags: text("tags").array().notNull().default([]),
    stack: text("stack").array().notNull().default([]),
    year: integer("year"),
    institution: text("institution"),
    // La case "j'ai le droit de publier ce travail" : refusée en base si
    // décochée, pas seulement dans le formulaire.
    publishRightConfirmed: boolean("publish_right_confirmed").notNull(),
    searchVector: tsvector("search_vector")
      .notNull()
      .default(sql`''::tsvector`),
    // Salon public de la discussion, créé à la publication dans l'espace
    // système des travaux (`spaces.kind = 'work_discussions'`).
    channelId: uuid("channel_id")
      .unique()
      .references(() => channels.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("works_search_vector_idx").using("gin", table.searchVector),
    index("works_tags_idx").using("gin", table.tags),
    index("works_publisher_created_idx").on(table.publisherId, table.createdAt),
    index("works_created_idx").on(table.createdAt, table.id),
    check("works_publish_right_confirmed", sql`${table.publishRightConfirmed} = true`),
    check("works_year_range", sql`${table.year} is null or ${table.year} between 1950 and 2100`),
  ],
);

// Coauteurs qui ont un compte Kemet. Le publieur n'y figure jamais : il est
// auteur par `works.publisher_id`.
export const workAuthors = pgTable(
  "work_authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: workAuthorStatusEnum("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
  },
  (table) => [
    uniqueIndex("work_authors_work_profile_idx").on(table.workId, table.profileId),
    index("work_authors_profile_status_idx").on(table.profileId, table.status),
  ],
);

export const workExternalAuthors = pgTable(
  "work_external_authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [index("work_external_authors_work_idx").on(table.workId, table.position)],
);

export const workLinks = pgTable(
  "work_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    type: workLinkTypeEnum("type").notNull(),
    url: text("url").notNull(),
    label: text("label"),
    position: integer("position").notNull(),
  },
  (table) => [
    index("work_links_work_idx").on(table.workId, table.position),
    check("work_links_https", sql`${table.url} like 'https://%'`),
  ],
);

export const workAttachments = pgTable(
  "work_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nul tant que le PDF n'est pas rattaché à un travail publié.
    workId: uuid("work_id").references(() => works.id, { onDelete: "cascade" }),
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
    // Un seul PDF par travail.
    uniqueIndex("work_attachments_work_idx")
      .on(table.workId)
      .where(sql`${table.workId} is not null`),
    index("work_attachments_author_idx").on(table.authorId),
  ],
);

export const workMediaKindEnum = pgEnum("work_media_kind", ["image", "video", "youtube"]);
export const workMediaRoleEnum = pgEnum("work_media_role", ["cover", "gallery", "video"]);

// Couverture, galerie et vidéos d'un travail. Une image ou une vidéo envoyée
// attend sans travail (`work_id` nul) jusqu'à la publication, comme le PDF ;
// une vidéo YouTube n'existe qu'attachée, par son seul identifiant.
export const workMedia = pgTable(
  "work_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id").references(() => works.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: workMediaKindEnum("kind").notNull(),
    role: workMediaRoleEnum("role"),
    storageKey: text("storage_key").unique(),
    mimeType: text("mime_type"),
    originalName: text("original_name"),
    byteSize: bigint("byte_size", { mode: "number" }).notNull().default(0),
    youtubeId: text("youtube_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("work_media_work_idx").on(table.workId, table.position),
    index("work_media_author_idx").on(table.authorId),
    uniqueIndex("work_media_one_cover_idx")
      .on(table.workId)
      .where(sql`${table.role} = 'cover'`),
    check(
      "work_media_source",
      sql`(${table.kind} = 'youtube') = (${table.youtubeId} is not null and ${table.storageKey} is null)`,
    ),
    check(
      "work_media_youtube_id",
      sql`${table.youtubeId} is null or ${table.youtubeId} ~ '^[A-Za-z0-9_-]{11}$'`,
    ),
    check(
      "work_media_role_matches_kind",
      sql`${table.role} is null or (${table.kind} = 'image') = (${table.role} in ('cover', 'gallery'))`,
    ),
  ],
);

export const worksRelations = relations(works, ({ one, many }) => ({
  publisher: one(profiles, { fields: [works.publisherId], references: [profiles.id] }),
  authors: many(workAuthors),
  externalAuthors: many(workExternalAuthors),
  links: many(workLinks),
  attachments: many(workAttachments),
  media: many(workMedia),
}));

export const workMediaRelations = relations(workMedia, ({ one }) => ({
  work: one(works, { fields: [workMedia.workId], references: [works.id] }),
  author: one(profiles, { fields: [workMedia.authorId], references: [profiles.id] }),
}));

export const workAuthorsRelations = relations(workAuthors, ({ one }) => ({
  work: one(works, { fields: [workAuthors.workId], references: [works.id] }),
  profile: one(profiles, { fields: [workAuthors.profileId], references: [profiles.id] }),
}));

export const workExternalAuthorsRelations = relations(workExternalAuthors, ({ one }) => ({
  work: one(works, { fields: [workExternalAuthors.workId], references: [works.id] }),
}));

export const workLinksRelations = relations(workLinks, ({ one }) => ({
  work: one(works, { fields: [workLinks.workId], references: [works.id] }),
}));

export const workAttachmentsRelations = relations(workAttachments, ({ one }) => ({
  work: one(works, { fields: [workAttachments.workId], references: [works.id] }),
  author: one(profiles, { fields: [workAttachments.authorId], references: [profiles.id] }),
}));
