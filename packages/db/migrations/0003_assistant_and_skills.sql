CREATE TYPE "public"."assistant_invocation_status" AS ENUM('pending', 'streaming', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."llm_provider_name" AS ENUM('gemini', 'openrouter');--> statement-breakpoint
CREATE TYPE "public"."skill_visibility" AS ENUM('private', 'space', 'public');--> statement-breakpoint
CREATE TABLE "assistant_invocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"trigger_message_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"response_message_id" uuid,
	"skill_ids" uuid[] DEFAULT '{}' NOT NULL,
	"provider" "llm_provider_name",
	"status" "assistant_invocation_status" DEFAULT 'pending' NOT NULL,
	"error_code" text,
	"helpful" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"rater_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_ratings_stars_range" CHECK ("skill_ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"space_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"visibility" "skill_visibility" DEFAULT 'public' NOT NULL,
	"search_vector" "tsvector" DEFAULT ''::tsvector NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug"),
	CONSTRAINT "skills_space_visibility_requires_space" CHECK ("skills"."visibility" <> 'space' or "skills"."space_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_trigger_message_id_messages_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_requested_by_profiles_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_invocations" ADD CONSTRAINT "assistant_invocations_response_message_id_messages_id_fk" FOREIGN KEY ("response_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_files" ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_ratings" ADD CONSTRAINT "skill_ratings_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_ratings" ADD CONSTRAINT "skill_ratings_rater_id_profiles_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_invocations_requested_by_created_at_idx" ON "assistant_invocations" USING btree ("requested_by","created_at");--> statement-breakpoint
CREATE INDEX "assistant_invocations_channel_idx" ON "assistant_invocations" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_files_skill_filename_idx" ON "skill_files" USING btree ("skill_id","filename");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_ratings_skill_rater_idx" ON "skill_ratings" USING btree ("skill_id","rater_id");--> statement-breakpoint
CREATE INDEX "skills_search_vector_idx" ON "skills" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "skills_author_idx" ON "skills" USING btree ("author_id");--> statement-breakpoint
CREATE FUNCTION skills_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER skills_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, tags ON skills
  FOR EACH ROW EXECUTE FUNCTION skills_search_vector_update();
--> statement-breakpoint
-- Identité système de l'assistant @kemet, fixe pour que les messages qu'il
-- poste référencent toujours le même profil (voir KEMET_ASSISTANT_PROFILE_ID
-- dans apps/server/src/chat/kemet-assistant.ts). Jamais connectable : aucun
-- compte d'identifiants n'est créé pour cet utilisateur.
INSERT INTO "user" (id, name, email, email_verified)
VALUES ('kemet-assistant', 'kemet', 'assistant@kemet.internal', true)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO profiles (id, user_id, handle, display_name, country, title, bio, stack, is_demo)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'kemet-assistant',
  'kemet',
  'kemet',
  'SN',
  'Assistant',
  'L''assistant de Kemet, nourri par les skills que la communauté publie.',
  '{}',
  false
)
ON CONFLICT DO NOTHING;
