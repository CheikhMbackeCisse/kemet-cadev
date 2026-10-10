CREATE TYPE "public"."attachment_kind" AS ENUM('image', 'file');--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"channel_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"mime_type" text NOT NULL,
	"original_name" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_attachments_author_idx" ON "message_attachments" USING btree ("author_id");