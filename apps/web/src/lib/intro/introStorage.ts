import {
  COUNTRY_CODES,
  intentSchema,
  interestSchema,
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
  interests?: Interest[];
  intents?: Intent[];
  country?: string;
}

interface Stored {
  seen: boolean;
  answers: IntroAnswers;
}

const STORAGE_KEY = "kemet.intro";

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
  const record = raw as { seen?: unknown; answers?: Record<string, unknown> };
  const answers = typeof record.answers === "object" && record.answers !== null ? record.answers : {};
  const role = profileRoleSchema.safeParse(answers.role);
  const country = typeof answers.country === "string" && COUNTRY_CODES.includes(answers.country) ? answers.country : undefined;
  return {
    seen: record.seen === true,
    answers: {
      ...(role.success && { role: role.data }),
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
  write({ ...read(), answers });
}

export function clearIntroAnswers(): void {
  write({ seen: true, answers: {} });
}

export function hasIntroAnswers(answers: IntroAnswers): boolean {
  return Boolean(answers.role || answers.country || answers.interests?.length || answers.intents?.length);
}
