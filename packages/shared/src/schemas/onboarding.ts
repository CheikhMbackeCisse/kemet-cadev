import { z } from "zod";
import {
  INTENTS,
  INTERESTS,
  ONBOARDING_STEPS,
  OTHER_ANSWER_MAX_LENGTH,
} from "../data/onboarding-values.js";
import { levelSchema } from "./points.js";
import { profileSummarySchema } from "./profile.js";

export const interestSchema = z.enum(INTERESTS);

export type Interest = z.infer<typeof interestSchema>;

/**
 * Mots cherchés, sans accent et en minuscules, dans le nom et la description
 * d'un espace, et dans la spécialité, la stack et la bio d'une personne.
 * "other" n'en a aucun : il ne rapproche de rien.
 */
export const INTEREST_KEYWORDS: Record<Interest, readonly string[]> = {
  web: ["web", "frontend", "front-end", "react", "javascript", "typescript", "html", "css"],
  mobile: ["mobile", "flutter", "android", "ios", "kotlin", "swift", "react native"],
  backend: ["backend", "back-end", "api", "node", "django", "laravel", "spring", "graphql"],
  ai: ["ia", "intelligence artificielle", "machine learning", "nlp", "llm", "deep learning", "ml"],
  data: ["data", "donnees", "sql", "postgres", "analytics", "pipeline"],
  devops: ["devops", "docker", "kubernetes", "ci", "infra", "cloud", "deploiement"],
  security: ["securite", "cybersecurite", "security", "auth", "chiffrement", "pentest"],
  networks: ["reseau", "reseaux", "telecom", "telecoms", "network", "5g", "cisco"],
  embedded: ["embarque", "iot", "arduino", "lora", "firmware", "esp32"],
  payments: ["paiement", "payment", "mobile money", "fintech", "wave", "momo", "idempotence"],
  blockchain: ["blockchain", "web3", "solidity", "smart contract", "crypto"],
  games: ["jeu", "jeux", "game", "unity", "godot"],
  design: ["design", "ux", "ui", "figma", "interface"],
  testing: ["test", "tests", "qualite", "qa", "playwright", "vitest"],
  systems: ["linux", "systeme", "systemes", "sysadmin", "bash", "kernel"],
  other: [],
};

/** Précision écrite à côté d'un choix "Autre". */
export const otherAnswerSchema = z.string().trim().min(1).max(OTHER_ANSWER_MAX_LENGTH);

export const intentSchema = z.enum(INTENTS);

export type Intent = z.infer<typeof intentSchema>;

export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingStateSchema = z.object({
  /** Écran où reprendre ; sans objet une fois le parcours terminé. */
  step: onboardingStepSchema,
  completed: z.boolean(),
  interests: z.array(interestSchema),
  interestOther: z.string().nullable(),
  intents: z.array(intentSchema),
  roleOther: z.string().nullable(),
});

export type OnboardingState = z.infer<typeof onboardingStateSchema>;

export const updateOnboardingSchema = z
  .object({
    step: onboardingStepSchema,
    completed: z.literal(true),
    interests: z.array(interestSchema).max(INTERESTS.length),
    interestOther: otherAnswerSchema.nullable(),
    intents: z.array(intentSchema).max(INTENTS.length),
    roleOther: otherAnswerSchema.nullable(),
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
