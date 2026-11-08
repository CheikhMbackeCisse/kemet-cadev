import { z } from "zod";
import { levelSchema } from "./points.js";
import { profileSummarySchema } from "./profile.js";

/** Sujets proposés à l'écran "Sujets d'intérêt". Ils ne servent qu'aux suggestions d'espaces et de personnes. */
export const INTERESTS = [
  "web",
  "mobile",
  "payments",
  "ai",
  "devops",
  "data",
  "design",
  "security",
  "games",
  "embedded",
] as const;

export const interestSchema = z.enum(INTERESTS);

export type Interest = z.infer<typeof interestSchema>;

/**
 * Mots cherchés, sans accent et en minuscules, dans le nom et la description
 * d'un espace, et dans la spécialité, la stack et la bio d'une personne.
 */
export const INTEREST_KEYWORDS: Record<Interest, readonly string[]> = {
  web: ["web", "frontend", "front-end", "backend", "react", "api", "javascript", "typescript", "node"],
  mobile: ["mobile", "flutter", "android", "ios", "kotlin", "swift", "react native"],
  payments: ["paiement", "payment", "mobile money", "fintech", "wave", "momo", "idempotence"],
  ai: ["ia", "intelligence artificielle", "machine learning", "nlp", "llm", "deep learning", "ml"],
  devops: ["devops", "docker", "kubernetes", "ci", "infra", "cloud", "deploiement"],
  data: ["data", "donnees", "sql", "postgres", "analytics", "pipeline"],
  design: ["design", "ux", "ui", "figma", "interface"],
  security: ["securite", "security", "auth", "chiffrement", "pentest"],
  games: ["jeu", "jeux", "game", "unity", "godot"],
  embedded: ["embarque", "iot", "arduino", "lora", "firmware", "esp32"],
};

/** Les six écrans, dans l'ordre. Le pays, le rôle et la spécialité sont des champs du profil. */
export const ONBOARDING_STEPS = ["country", "role", "specialty", "interests", "spaces", "people"] as const;

export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingStateSchema = z.object({
  /** Écran où reprendre ; sans objet une fois le parcours terminé. */
  step: onboardingStepSchema,
  completed: z.boolean(),
  interests: z.array(interestSchema),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const updateOnboardingSchema = z
  .object({
    step: onboardingStepSchema,
    completed: z.literal(true),
    interests: z.array(interestSchema).max(INTERESTS.length),
  })
  .partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, { message: "Rien à enregistrer." });

export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export const ONBOARDING_PEOPLE_SUGGESTIONS = 5;

export const personSuggestionSchema = z.object({
  profile: profileSummarySchema,
  level: levelSchema,
  isFollowed: z.boolean(),
});

export type PersonSuggestion = z.infer<typeof personSuggestionSchema>;
