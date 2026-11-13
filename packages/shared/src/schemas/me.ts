import { z } from "zod";
import { credentialSchema } from "./credential.js";
import { onboardingStateSchema } from "./onboarding.js";
import { profileSchema } from "./profile.js";

export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    emailVerified: z.boolean(),
    name: z.string(),
  }),
  profile: profileSchema.nullable(),
  // Seulement sur son propre profil : les autres ne voient que le niveau.
  points: z.number().int().nonnegative(),
  credentials: z.array(credentialSchema),
  // Affiche les actions réservées : valider une compétition, traiter un signalement.
  isPlatformAdmin: z.boolean(),
  // L'interface masque composeur et actions ; le serveur refuse de toute façon.
  isSuspended: z.boolean(),
  // Pour la suppression du compte : mot de passe à confirmer, ou fournisseurs
  // avec lesquels se reconnecter.
  hasPassword: z.boolean(),
  socialProviders: z.array(z.string()),
  // Nul tant que le profil n'existe pas (avant /completer-profil).
  onboarding: onboardingStateSchema.nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * Confirmation de la suppression du compte : le mot de passe pour un compte
 * email, rien pour un compte GitHub, Google ou LinkedIn, qui doit s'être
 * reconnecté depuis moins de cinq minutes.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200).optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const ACCOUNT_DELETION_FRESH_LOGIN_MINUTES = 5;

export const publicProfileResponseSchema = z.object({
  profile: profileSchema,
  credentials: z.array(credentialSchema),
  followerCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  /** Travaux publiés et travaux co-signés acceptés, comme l'onglet Bibliothèque. */
  workCount: z.number().int().nonnegative(),
  /** Offres publiées et visibles, closes comprises : en-tête d'une organisation. */
  opportunityCount: z.number().int().nonnegative(),
  isFollowedByViewer: z.boolean().nullable(),
  /** Faux pour un profil sans compte de connexion (organisation du seed, compte supprimé). */
  acceptsMessages: z.boolean(),
});

export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
