CREATE TYPE "public"."conversation_member_status" AS ENUM('accepted', 'pending', 'left');--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'conversation';--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "conversation_member_status" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"direct_key" text,
	"work_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_direct_key_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
CREATE TABLE "profile_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_blocks_no_self_block" CHECK ("profile_blocks"."blocker_id" != "profile_blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "space_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reported_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "excerpt_until" timestamp;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_blocks" ADD CONSTRAINT "profile_blocks_blocker_id_profiles_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_blocks" ADD CONSTRAINT "profile_blocks_blocked_id_profiles_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_members_conversation_profile_idx" ON "conversation_members" USING btree ("conversation_id","profile_id");--> statement-breakpoint
CREATE INDEX "conversation_members_profile_idx" ON "conversation_members" USING btree ("profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_work_creator_idx" ON "conversations" USING btree ("work_id","created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_blocks_blocker_blocked_idx" ON "profile_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "profile_blocks_blocked_idx" ON "profile_blocks" USING btree ("blocked_id");--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_profile_id_profiles_id_fk" FOREIGN KEY ("reported_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channels_conversation_idx" ON "channels" USING btree ("conversation_id");--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_space_xor_conversation" CHECK (("channels"."space_id" is null) <> ("channels"."conversation_id" is null));