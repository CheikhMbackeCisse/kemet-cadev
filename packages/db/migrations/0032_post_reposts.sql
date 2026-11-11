CREATE TABLE "post_reposts" (
	"post_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_reposts" ADD CONSTRAINT "post_reposts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reposts_profile_post_idx" ON "post_reposts" USING btree ("profile_id","post_id");--> statement-breakpoint
CREATE INDEX "post_reposts_profile_created_idx" ON "post_reposts" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "post_reposts_post_idx" ON "post_reposts" USING btree ("post_id");