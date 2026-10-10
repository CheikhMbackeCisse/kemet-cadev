CREATE TYPE "public"."points_source" AS ENUM('post_reply_solution', 'post_feedback_given', 'assistant_skill_helpful');--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"source" "points_source" NOT NULL,
	"source_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"given_by_profile_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_given_by_profile_id_profiles_id_fk" FOREIGN KEY ("given_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_source_dedup_idx" ON "points_ledger" USING btree ("source","source_id","profile_id");--> statement-breakpoint
CREATE INDEX "points_ledger_profile_created_idx" ON "points_ledger" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "points_ledger_giver_created_idx" ON "points_ledger" USING btree ("given_by_profile_id","profile_id","created_at");