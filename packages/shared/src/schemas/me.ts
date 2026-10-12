import { z } from "zod";
import { credentialSchema } from "./credential.js";
import { profileSchema } from "./profile.js";

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean(),
  }),
  profile: profileSchema.nullable(),
  // Visible seulement sur son propre profil : docs/CONTEXTE.md veut que le
  // total reste discret pour les autres, qui ne voient que le niveau.
  points: z.number().int().nonnegative(),
  credentials: z.array(credentialSchema),
  // Sert à afficher les actions réservées (valider une compétition, lot 10,
  // ou résoudre un signalement, lot 7 bis) ; aucune interface ne permet
  // encore de changer ce champ, voir packages/db/src/schema/profiles.ts.
  isPlatformAdmin: z.boolean(),
  // Un compte suspendu (lot 7 bis) garde l'accès en lecture mais ne peut
  // plus écrire : l'interface s'appuie sur ce champ pour masquer composeur
  // et actions, en plus du rejet côté serveur.
  isSuspended: z.boolean(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export const publicProfileResponseSchema = z.object({
  profile: profileSchema,
  credentials: z.array(credentialSchema),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  isFollowedByViewer: z.boolean().nullable(),
});

export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
