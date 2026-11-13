import type { IntroAnswers } from "./introStorage.js";

/** Les trois questions posées avant l'inscription. */
export const INTRO_QUESTIONS = ["who", "domains", "country"] as const;

export type IntroQuestion = (typeof INTRO_QUESTIONS)[number];

const SLUGS: Record<IntroQuestion, string> = {
  who: "qui",
  domains: "domaines",
  country: "pays",
};

export const INTRO_BASE_PATH = "/decouvrir";

export function introQuestionPath(question: IntroQuestion): string {
  return `${INTRO_BASE_PATH}/${SLUGS[question]}`;
}

export function questionFromPath(pathname: string): IntroQuestion | null {
  const slug = pathname.replace(/\/+$/, "").slice(INTRO_BASE_PATH.length + 1);
  return INTRO_QUESTIONS.find((question) => SLUGS[question] === slug) ?? null;
}

/** Un développeur ou un étudiant choisit ses domaines ; les autres disent ce qu'ils cherchent. */
export function asksForDomains(answers: IntroAnswers): boolean {
  return answers.role === undefined || answers.role === "developer" || answers.role === "student";
}
