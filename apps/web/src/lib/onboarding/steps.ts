import { ONBOARDING_STEPS, type MeResponse, type OnboardingStep } from "@kemet/shared";
import type { SessionStatus } from "../../session/SessionProvider.js";

const STEP_SLUGS: Record<OnboardingStep, string> = {
  country: "pays",
  role: "role",
  role_detail: "precision",
  specialty: "specialite",
  interests: "interets",
  spaces: "espaces",
  people: "personnes",
};

export const ONBOARDING_BASE_PATH = "/bienvenue";

export function onboardingPath(step: OnboardingStep): string {
  return `${ONBOARDING_BASE_PATH}/${STEP_SLUGS[step]}`;
}

/** Écran désigné par l'adresse, ou null si elle ne correspond à aucun. */
export function stepFromPath(pathname: string): OnboardingStep | null {
  const slug = pathname.replace(/\/+$/, "").slice(ONBOARDING_BASE_PATH.length + 1);
  return ONBOARDING_STEPS.find((step) => STEP_SLUGS[step] === slug) ?? null;
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) - 1] ?? null;
}

/**
 * Où envoyer une personne connectée qui arrive sans destination précise :
 * créer son profil, reprendre l'onboarding là où elle l'a laissé, ou le fil.
 */
export function landingPath(status: SessionStatus, onboarding: MeResponse["onboarding"]): string {
  if (status === "incomplete") return "/completer-profil";
  if (onboarding && !onboarding.completed) return onboardingPath(onboarding.step);
  return "/fil";
}
