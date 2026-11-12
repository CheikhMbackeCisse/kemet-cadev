ALTER TABLE "posts" ADD COLUMN "published_by_id" uuid;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "published_by_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_published_by_id_profiles_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_published_by_id_profiles_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;