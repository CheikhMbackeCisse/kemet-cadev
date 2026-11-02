ALTER TYPE "public"."points_source" ADD VALUE 'credential_verified' BEFORE 'post_reply_solution';--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "verified_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "credentials" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_verified_by_profile_id_profiles_id_fk" FOREIGN KEY ("verified_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;