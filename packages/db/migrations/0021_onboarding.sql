CREATE TYPE "public"."onboarding_step" AS ENUM('country', 'role', 'specialty', 'interests', 'spaces', 'people');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "interests" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarding_step" "onboarding_step" DEFAULT 'country' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
-- Les comptes créés avant l'onboarding ne le voient jamais : il est
-- marqué terminé pour eux, comme pour les comptes de démonstration du seed.
UPDATE "profiles" SET "onboarding_completed_at" = now() WHERE "onboarding_completed_at" IS NULL;
