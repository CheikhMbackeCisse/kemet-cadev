CREATE TYPE "public"."profile_work_mode" AS ENUM('freelance', 'employed');--> statement-breakpoint
ALTER TYPE "public"."onboarding_step" ADD VALUE 'role_detail' BEFORE 'specialty';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "work_mode" "profile_work_mode";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "organization" text;