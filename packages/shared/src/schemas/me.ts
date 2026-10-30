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
  // Seulement sur son propre profil : les autres ne voient que le niveau.
  points: z.number().int().nonnegative(),
  credentials: z.array(credentialSchema),
  // Affiche les actions réservées : valider une compétition, traiter un signalement.
  isPlatformAdmin: z.boolean(),
  // L'interface masque composeur et actions ; le serveur refuse de toute façon.
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
