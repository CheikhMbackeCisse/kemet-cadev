CREATE TYPE "public"."space_kind" AS ENUM('community', 'work_discussions');--> statement-breakpoint
CREATE TYPE "public"."work_match_mode" AS ENUM('assistant', 'recorded', 'full_text');--> statement-breakpoint
CREATE TYPE "public"."work_match_subject" AS ENUM('work', 'project', 'post');--> statement-breakpoint
CREATE TYPE "public"."work_author_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."work_link_type" AS ENUM('github', 'gitlab', 'drive', 'site', 'video', 'article', 'other');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('completed', 'in_progress');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('class_project', 'internship', 'thesis_research', 'application', 'article', 'other');--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'work';--> statement-breakpoint
CREATE TABLE "work_match_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" uuid NOT NULL,
	"subject_type" "work_match_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"mode" "work_match_mode" NOT NULL,
	"provider" "llm_provider_name",
	"candidate_count" integer NOT NULL,
	"suggestion_count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid,
	"author_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"original_name" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "work_attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "work_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "work_author_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "work_external_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"type" "work_link_type" NOT NULL,
	"url" text NOT NULL,
	"label" text,
	"position" integer NOT NULL,
	CONSTRAINT "work_links_https" CHECK ("work_links"."url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"type" "work_type" NOT NULL,
	"status" "work_status" DEFAULT 'completed' NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"stack" text[] DEFAULT '{}' NOT NULL,
	"year" integer,
	"institution" text,
	"publish_right_confirmed" boolean NOT NULL,
	"search_vector" "tsvector" DEFAULT ''::tsvector NOT NULL,
	"channel_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "works_slug_unique" UNIQUE("slug"),
	CONSTRAINT "works_channel_id_unique" UNIQUE("channel_id"),
	CONSTRAINT "works_publish_right_confirmed" CHECK ("works"."publish_right_confirmed" = true),
	CONSTRAINT "works_year_range" CHECK ("works"."year" is null or "works"."year" between 1950 and 2100)
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "kind" "space_kind" DEFAULT 'community' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "work_id" uuid;--> statement-breakpoint
ALTER TABLE "work_match_requests" ADD CONSTRAINT "work_match_requests_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_attachments" ADD CONSTRAINT "work_attachments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_authors" ADD CONSTRAINT "work_authors_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_external_authors" ADD CONSTRAINT "work_external_authors_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_links" ADD CONSTRAINT "work_links_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_publisher_id_profiles_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "work_match_requests_requested_by_created_idx" ON "work_match_requests" USING btree ("requested_by","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "work_attachments_work_idx" ON "work_attachments" USING btree ("work_id") WHERE "work_attachments"."work_id" is not null;--> statement-breakpoint
CREATE INDEX "work_attachments_author_idx" ON "work_attachments" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_authors_work_profile_idx" ON "work_authors" USING btree ("work_id","profile_id");--> statement-breakpoint
CREATE INDEX "work_authors_profile_status_idx" ON "work_authors" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "work_external_authors_work_idx" ON "work_external_authors" USING btree ("work_id","position");--> statement-breakpoint
CREATE INDEX "work_links_work_idx" ON "work_links" USING btree ("work_id","position");--> statement-breakpoint
CREATE INDEX "works_search_vector_idx" ON "works" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "works_tags_idx" ON "works" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "works_publisher_created_idx" ON "works" USING btree ("publisher_id","created_at");--> statement-breakpoint
CREATE INDEX "works_created_idx" ON "works" USING btree ("created_at","id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_work_idx" ON "posts" USING btree ("work_id");