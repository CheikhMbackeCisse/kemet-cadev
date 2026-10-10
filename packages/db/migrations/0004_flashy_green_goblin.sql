CREATE TYPE "public"."post_format" AS ENUM('astuce', 'a_tester', 'question');--> statement-breakpoint
CREATE TABLE "post_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_solution" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"shared_post_id" uuid,
	"body" text DEFAULT '' NOT NULL,
	"format" "post_format",
	"test_url" text,
	"test_ask" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "posts_body_or_share" CHECK (length("posts"."body") > 0 or "posts"."shared_post_id" is not null),
	CONSTRAINT "posts_test_fields_require_a_tester_format" CHECK (coalesce("posts"."format" = 'a_tester', false) or ("posts"."test_url" is null and "posts"."test_ask" is null))
);
--> statement-breakpoint
ALTER TABLE "post_feedback" ADD CONSTRAINT "post_feedback_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_feedback" ADD CONSTRAINT "post_feedback_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_replies" ADD CONSTRAINT "post_replies_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_replies" ADD CONSTRAINT "post_replies_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_shared_post_id_posts_id_fk" FOREIGN KEY ("shared_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_feedback_post_author_idx" ON "post_feedback" USING btree ("post_id","author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_profile_idx" ON "post_reactions" USING btree ("post_id","profile_id");--> statement-breakpoint
CREATE INDEX "post_replies_post_created_idx" ON "post_replies" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_author_created_idx" ON "posts" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_shared_post_idx" ON "posts" USING btree ("shared_post_id");