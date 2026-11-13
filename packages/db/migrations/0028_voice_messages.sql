ALTER TYPE "public"."attachment_kind" ADD VALUE 'voice';--> statement-breakpoint
ALTER TABLE "message_attachments" ADD COLUMN "duration_ms" integer;