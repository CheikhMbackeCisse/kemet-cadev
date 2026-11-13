ALTER TABLE "assistant_invocations" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ALTER COLUMN "trigger_message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD COLUMN "post_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD COLUMN "trigger_reply_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD COLUMN "response_reply_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_trigger_reply_id_post_replies_id_fk" FOREIGN KEY ("trigger_reply_id") REFERENCES "public"."post_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_response_reply_id_post_replies_id_fk" FOREIGN KEY ("response_reply_id") REFERENCES "public"."post_replies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_invocations_post_idx" ON "assistant_invocations" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "assistant_invocations_response_reply_idx" ON "assistant_invocations" USING btree ("response_reply_id");--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_one_target" CHECK (("assistant_invocations"."channel_id" is not null and "assistant_invocations"."trigger_message_id" is not null and "assistant_invocations"."post_id" is null and "assistant_invocations"."trigger_reply_id" is null)
        or ("assistant_invocations"."post_id" is not null and "assistant_invocations"."trigger_reply_id" is not null and "assistant_invocations"."channel_id" is null and "assistant_invocations"."trigger_message_id" is null));