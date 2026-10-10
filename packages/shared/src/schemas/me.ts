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
