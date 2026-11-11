CREATE TYPE "public"."contract_type" AS ENUM('cdi', 'cdd', 'alternance', 'stage', 'freelance');--> statement-breakpoint
CREATE TYPE "public"."opportunity_kind" AS ENUM('job', 'internship', 'mission');--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" "opportunity_kind" NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"country_code" text,
	"city" text,
	"domains" text[] DEFAULT '{}' NOT NULL,
	"description" text NOT NULL,
	"contract_type" "contract_type",
	"start_date" date,
	"compensation_fcfa" integer,
	"budget_min_fcfa" integer,
	"budget_max_fcfa" integer,
	"deadline" date,
	"criteria" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "opportunities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "opportunities_location" CHECK ("opportunities"."remote" or "opportunities"."country_code" is not null),
	CONSTRAINT "opportunities_kind_fields" CHECK (("opportunities"."kind" = 'mission' and "opportunities"."budget_min_fcfa" is not null and "opportunities"."budget_max_fcfa" is not null
          and "opportunities"."budget_min_fcfa" <= "opportunities"."budget_max_fcfa" and "opportunities"."deadline" is not null
          and "opportunities"."contract_type" is null and "opportunities"."start_date" is null and "opportunities"."compensation_fcfa" is null)
        or ("opportunities"."kind" in ('job', 'internship') and "opportunities"."contract_type" is not null and "opportunities"."start_date" is not null
          and "opportunities"."budget_min_fcfa" is null and "opportunities"."budget_max_fcfa" is null))
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opportunities_created_idx" ON "opportunities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "opportunities_author_idx" ON "opportunities" USING btree ("author_id");