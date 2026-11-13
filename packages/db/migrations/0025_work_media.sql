CREATE TYPE "public"."work_media_kind" AS ENUM('image', 'video', 'youtube');--> statement-breakpoint
CREATE TYPE "public"."work_media_role" AS ENUM('cover', 'gallery', 'video');--> statement-breakpoint
CREATE TABLE "work_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid,
	"author_id" uuid NOT NULL,
	"kind" "work_media_kind" NOT NULL,
	"role" "work_media_role",
	"storage_key" text,
	"mime_type" text,
	"original_name" text,
	"byte_size" bigint DEFAULT 0 NOT NULL,
	"youtube_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "work_media_source" CHECK (("work_media"."kind" = 'youtube') = ("work_media"."youtube_id" is not null and "work_media"."storage_key" is null)),
	CONSTRAINT "work_media_youtube_id" CHECK ("work_media"."youtube_id" is null or "work_media"."youtube_id" ~ '^[A-Za-z0-9_-]{11}$'),
	CONSTRAINT "work_media_role_matches_kind" CHECK ("work_media"."role" is null or ("work_media"."kind" = 'image') = ("work_media"."role" in ('cover', 'gallery')))
);
--> statement-breakpoint
ALTER TABLE "work_media" ADD CONSTRAINT "work_media_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_media" ADD CONSTRAINT "work_media_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_media_work_idx" ON "work_media" USING btree ("work_id","position");--> statement-breakpoint
CREATE INDEX "work_media_author_idx" ON "work_media" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_media_one_cover_idx" ON "work_media" USING btree ("work_id") WHERE "work_media"."role" = 'cover';