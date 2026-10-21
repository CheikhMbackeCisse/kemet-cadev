CREATE TYPE "public"."profile_role" AS ENUM('developer', 'designer', 'hr', 'student', 'project_manager', 'other');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "role" "profile_role";