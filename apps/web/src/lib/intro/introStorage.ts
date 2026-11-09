import {
  COUNTRY_CODES,
  INTENTS,
  INTERESTS,
  OTHER_ANSWER_MAX_LENGTH,
  PROFILE_ROLES,
  type Intent,
  type Interest,
  type ProfileRole,
} from "@kemet/shared";

/**
 * Réponses données avant d'avoir un compte. Elles restent dans ce navigateur
 * et ne partent au serveur qu'une fois le compte créé (OnboardingPage).
 */
export interface IntroAnswers {
  role?: ProfileRole;
  /** Précision écrite quand le rôle est "other". */
  roleOther?: string;
  interests?: Interest[];
  /** Précision écrite quand le sujet "other" est coché. */
  interestOther?: string;
  intents?: Intent[];
  country?: string;
}

interface Stored {
  seen: boolean;
  answers: IntroAnswers;
  /** Date des réponses, en millisecondes. */
  savedAt?: number;
}

const STORAGE_KEY = "kemet.intro";

// Sur un poste partagé, les réponses d'un visiteur ne doivent pas finir sur
// le compte créé par quelqu'un d'autre le lendemain.
const ANSWERS_LIFETIME_MS = 24 * 60 * 60 * 1000;

function oneOf<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((candidate) => candidate === value);
}

function parseList<T extends string>(values: readonly T[], value: unknown): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const parsed = oneOf(values, item);
    return parsed === undefined ? [] : [parsed];
  });
}

// Mêmes règles que otherAnswerSchema, sans zod : ce module fait partie du
// premier fichier chargé, que zod alourdirait d'environ 35 ko compressés.
function parseOtherAnswer(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= OTHER_ANSWER_MAX_LENGTH ? trimmed : undefined;
}

// Le contenu vient du navigateur : chaque valeur est relue avec les listes
// partagées, et ce qui ne passe pas est simplement oublié.
function parseStored(raw: unknown): Stored {
  if (typeof raw !== "object" || raw === null) return { seen: false, answers: {} };
  const record = raw as { seen?: unknown; answers?: Record<string, unknown>; savedAt?: unknown };
  const fresh = typeof record.savedAt === "number" && Date.now() - record.savedAt < ANSWERS_LIFETIME_MS;
  const answers = fresh && typeof record.answers === "object" && record.answers !== null ? record.answers : {};
  const role = oneOf(PROFILE_ROLES, answers.role);
  const roleOther = parseOtherAnswer(answers.roleOther);
  const interestOther = parseOtherAnswer(answers.interestOther);
  const country = oneOf(COUNTRY_CODES, answers.country);
  return {
    seen: record.seen === true,
    ...(fresh && { savedAt: record.savedAt as number }),
    answers: {
      ...(role && { role }),
      ...(roleOther && { roleOther }),
      ...(interestOther && { interestOther }),
      ...(country && { country }),
      interests: parseList(INTERESTS, answers.interests),
      intents: parseList(INTENTS, answers.intents),
    },
  };
}

// Le stockage peut être bloqué (navigation privée, réglages) : l'accueil
// s'affiche alors à chaque visite, sans jamais casser la page.
function read(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seen: false, answers: {} };
    return parseStored(JSON.parse(raw));
  } catch {
    return { seen: false, answers: {} };
  }
}

function write(value: Stored): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Voir read() : sans stockage, rien n'est mémorisé.
  }
}

export function hasSeenIntro(): boolean {
  return read().seen;
}

export function markIntroSeen(): void {
  const current = read();
  if (!current.seen) write({ ...current, seen: true });
}

export function readIntroAnswers(): IntroAnswers {
  return read().answers;
}

export function saveIntroAnswers(answers: IntroAnswers): void {
  write({ ...read(), answers, savedAt: Date.now() });
}

export function clearIntroAnswers(): void {
  write({ seen: true, answers: {} });
}

export function hasIntroAnswers(answers: IntroAnswers): boolean {
  return Boolean(answers.role || answers.country || answers.interests?.length || answers.intents?.length);
}
