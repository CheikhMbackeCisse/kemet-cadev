// Listes de valeurs sans zod : le premier fichier chargé par l'app web les lit
// (réponses gardées avant l'inscription) et ne doit pas embarquer zod pour ça.

export const PROFILE_ROLES = [
  "developer",
  "designer",
  "hr",
  "student",
  "project_manager",
  "entrepreneur",
  "other",
] as const;

/**
 * Domaines proposés avant l'inscription et à l'écran "Sujets d'intérêt". Ils ne
 * servent qu'aux suggestions d'espaces et de personnes. Les valeurs déjà
 * enregistrées (web, payments, embedded...) gardent leur nom.
 */
export const INTERESTS = [
  "web",
  "mobile",
  "backend",
  "ai",
  "data",
  "devops",
  "security",
  "networks",
  "embedded",
  "payments",
  "blockchain",
  "games",
  "design",
  "testing",
  "systems",
  "other",
] as const;

/**
 * Ce que la personne vient faire (apprendre, aider, montrer ses travaux,
 * recruter) ou, si elle ne développe pas, ce qu'elle cherche.
 */
export const INTENTS = [
  "learn",
  "help_others",
  "showcase_work",
  "recruit",
  "find_partner",
  "follow_community",
] as const;

/** Les six écrans, dans l'ordre. Le pays, le rôle et la spécialité sont des champs du profil. */
export const ONBOARDING_STEPS = [
  "country",
  "role",
  "specialty",
  "interests",
  "spaces",
  "people",
] as const;

/** Longueur maximale d'une précision écrite à côté d'un choix "Autre". */
export const OTHER_ANSWER_MAX_LENGTH = 60;
