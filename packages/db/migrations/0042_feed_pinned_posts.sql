CREATE TABLE "feed_pinned_posts" (
	"post_id" uuid PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_pinned_posts" ADD CONSTRAINT "feed_pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;