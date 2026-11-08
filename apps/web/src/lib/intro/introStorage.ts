import {
  COUNTRY_CODES,
  intentSchema,
  interestSchema,
  otherAnswerSchema,
  profileRoleSchema,
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

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const parsed = parse(item);
    return parsed === null ? [] : [parsed];
  });
}

// Le contenu vient du navigateur : chaque valeur est relue avec les schémas
// partagés, et ce qui ne passe pas est simplement oublié.
function parseStored(raw: unknown): Stored {
  if (typeof raw !== "object" || raw === null) return { seen: false, answers: {} };
  const record = raw as { seen?: unknown; answers?: Record<string, unknown>; savedAt?: unknown };
  const fresh = typeof record.savedAt === "number" && Date.now() - record.savedAt < ANSWERS_LIFETIME_MS;
  const answers = fresh && typeof record.answers === "object" && record.answers !== null ? record.answers : {};
  const role = profileRoleSchema.safeParse(answers.role);
  const roleOther = otherAnswerSchema.safeParse(answers.roleOther);
  const interestOther = otherAnswerSchema.safeParse(answers.interestOther);
  const country = typeof answers.country === "string" && COUNTRY_CODES.includes(answers.country) ? answers.country : undefined;
  return {
    seen: record.seen === true,
    ...(fresh && { savedAt: record.savedAt as number }),
    answers: {
      ...(role.success && { role: role.data }),
      ...(roleOther.success && { roleOther: roleOther.data }),
      ...(interestOther.success && { interestOther: interestOther.data }),
      ...(country && { country }),
      interests: parseList(answers.interests, (item) => interestSchema.safeParse(item).data ?? null),
      intents: parseList(answers.intents, (item) => intentSchema.safeParse(item).data ?? null),
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
