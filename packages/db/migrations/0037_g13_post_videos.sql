ALTER TABLE "post_attachments" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "poster_storage_key" text;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "poster_mime_type" text;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD COLUMN "poster_byte_size" bigint;--> statement-breakpoint
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_poster_storage_key_unique" UNIQUE("poster_storage_key");