ALTER TABLE "profiles" ADD COLUMN "is_filler" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Figurants déjà en base : profils de démonstration sans aucune ligne
-- `account`, donc sans mot de passe ni connexion sociale. Les dix comptes de
-- démonstration ont un mot de passe et ne sont pas concernés.
UPDATE "profiles" SET "is_filler" = true
WHERE "is_demo" = true
  AND "user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "account" WHERE "account"."user_id" = "profiles"."user_id");
