CREATE TABLE "space_pinned_posts" (
	"space_id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "media_credit" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "media_credit_url" text;--> statement-breakpoint
ALTER TABLE "space_pinned_posts" ADD CONSTRAINT "space_pinned_posts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_pinned_posts" ADD CONSTRAINT "space_pinned_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;