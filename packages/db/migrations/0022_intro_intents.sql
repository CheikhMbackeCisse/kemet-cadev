ALTER TYPE "public"."profile_role" ADD VALUE 'entrepreneur' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "intents" text[] DEFAULT '{}' NOT NULL;