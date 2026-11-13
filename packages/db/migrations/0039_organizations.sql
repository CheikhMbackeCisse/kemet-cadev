CREATE TYPE "public"."organization_type" AS ENUM('company', 'school', 'community', 'event_organizer');--> statement-breakpoint
CREATE TYPE "public"."profile_kind" AS ENUM('person', 'organization');--> statement-breakpoint
CREATE TYPE "public"."organization_request_status" AS ENUM('pending', 'accepted', 'refused');--> statement-breakpoint
CREATE TABLE "organization_managers" (
	"organization_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_managers_organization_id_manager_id_pk" PRIMARY KEY("organization_id","manager_id")
);
--> statement-breakpoint
CREATE TABLE "organization_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"name" text NOT NULL,
	"organization_type" "organization_type" NOT NULL,
	"country" text NOT NULL,
	"website_url" text,
	"description" text,
	"logo_storage_key" text,
	"logo_mime_type" text,
	"logo_byte_size" bigint,
	"status" "organization_request_status" DEFAULT 'pending' NOT NULL,
	"organization_id" uuid,
	"decided_by_id" uuid,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "kind" "profile_kind" DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "organization_type" "organization_type";--> statement-breakpoint
ALTER TABLE "organization_managers" ADD CONSTRAINT "organization_managers_organization_id_profiles_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_managers" ADD CONSTRAINT "organization_managers_manager_id_profiles_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_organization_id_profiles_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_decided_by_id_profiles_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_managers_manager_idx" ON "organization_managers" USING btree ("manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_requests_one_pending_idx" ON "organization_requests" USING btree ("requester_id") WHERE "organization_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_requests_status_idx" ON "organization_requests" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_organization_type" CHECK (("profiles"."kind" = 'organization') = ("profiles"."organization_type" is not null));