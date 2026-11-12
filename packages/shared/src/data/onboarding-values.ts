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

/**
 * Les écrans, dans l'ordre. Le pays, le rôle, sa précision et la spécialité
 * sont des champs du profil. "role_detail" ne se montre qu'aux rôles de
 * ROLES_WITH_DETAIL.
 */
export const ONBOARDING_STEPS = [
  "country",
  "role",
  "role_detail",
  "specialty",
  "interests",
  "spaces",
  "people",
] as const;

/** Rôles qui reçoivent une question de précision : établissement, freelance ou entreprise. */
export const ROLES_WITH_DETAIL = ["student", "developer", "hr", "entrepreneur"] as const;

/** Pour "Je code" : à son compte, ou dans une entreprise (nommée ou non). */
export const PROFILE_WORK_MODES = ["freelance", "employed"] as const;

/** Longueur maximale d'un nom d'établissement ou d'entreprise. */
export const ORGANIZATION_MAX_LENGTH = 80;

/** Longueur maximale d'une précision écrite à côté d'un choix "Autre". */
export const OTHER_ANSWER_MAX_LENGTH = 60;
