CREATE TYPE "public"."cv_visibility" AS ENUM('public', 'members');--> statement-breakpoint
CREATE TABLE "profile_cvs" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"visibility" "cv_visibility" DEFAULT 'members' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_cvs_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "is_beginner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_beginner" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gitlab_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "portfolio_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "helps_beginners" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_cvs" ADD CONSTRAINT "profile_cvs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Espace d'entraide des débutants, au nom du profil fixe de l'assistant comme
-- l'espace des discussions de travaux (0018) : il existe sur toute
-- installation, seed ou pas, et ne disparaît avec aucun compte.
INSERT INTO "spaces" ("id", "name", "slug", "description", "visibility", "kind", "created_by")
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Débuter en informatique',
  'debuter-en-informatique',
  'Pour celles et ceux qui commencent : questions de débutants, orientation et études, premiers projets. Aucune question n''est bête ici.',
  'public',
  'community',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "channels" ("id", "space_id", "name", "slug", "display_order")
VALUES
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000003', 'questions-de-débutants', 'questions-de-debutants', 0),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000003', 'orientation-et-études', 'orientation-et-etudes', 1),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000003', 'premiers-projets', 'premiers-projets', 2)
ON CONFLICT ("id") DO NOTHING;
