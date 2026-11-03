ALTER TABLE "profiles" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN "archived_at" timestamp;