CREATE TABLE "profile_avatars" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_avatars_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "profile_avatars" ADD CONSTRAINT "profile_avatars_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;