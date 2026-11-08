import { useEffect, useState } from "react";
import type { Intent, Interest, ProfileRole } from "@kemet/shared";
import { OnboardingLayout } from "../components/onboarding/OnboardingLayout.js";
import { ChoiceChips } from "../components/onboarding/ChoiceChips.js";
import { CountryList } from "../components/onboarding/CountryList.js";
import { InterestChips } from "../components/onboarding/InterestChips.js";
import { RadioList } from "../components/onboarding/RadioList.js";
import {
  asksForDomains,
  INTRO_BASE_PATH,
  INTRO_QUESTIONS,
  introQuestionPath,
  questionFromPath,
  type IntroQuestion,
} from "../lib/intro/introSteps.js";
import { markIntroSeen, readIntroAnswers, saveIntroAnswers, type IntroAnswers } from "../lib/intro/introStorage.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { fr } from "../i18n/fr.js";

const WHO_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: "developer", label: fr.intro.whoDeveloper },
  { value: "student", label: fr.intro.whoStudent },
  { value: "hr", label: fr.intro.whoHr },
  { value: "entrepreneur", label: fr.intro.whoEntrepreneur },
  { value: "other", label: fr.intro.whoOther },
];

const SEEKING_OPTIONS = ["recruit", "find_partner", "follow_community"] as const satisfies readonly Intent[];
const GOAL_OPTIONS = ["learn", "help_others", "showcase_work", "recruit"] as const satisfies readonly Intent[];

/** Remplace, dans la liste des intentions, celles qu'un écran propose, sans toucher aux autres. */
function replaceIntents(current: Intent[], offered: readonly Intent[], chosen: Intent[]): Intent[] {
  return [...new Set([...current.filter((intent) => !offered.includes(intent)), ...chosen])];
}

/**
 * Quatre questions posées à un visiteur avant l'inscription. Les réponses
 * restent dans le navigateur ; elles rejoignent le profil une fois le compte
 * créé (OnboardingPage).
 */
export function IntroQuestionsPage() {
  const [question, setQuestion] = useState<IntroQuestion>(() => questionFromPath(window.location.pathname) ?? "who");
  const [answers, setAnswers] = useState<IntroAnswers>(() => readIntroAnswers());

  useEffect(() => {
    function handlePopState() {
      setQuestion(questionFromPath(window.location.pathname) ?? "who");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const index = INTRO_QUESTIONS.indexOf(question);
  const next = INTRO_QUESTIONS[index + 1] ?? null;
  const previous = INTRO_QUESTIONS[index - 1] ?? null;

  function goTo(target: IntroQuestion | null, updated: IntroAnswers = answers) {
    saveIntroAnswers(updated);
    if (!target) {
      markIntroSeen();
      window.location.href = SIGN_UP_PATH;
      return;
    }
    window.history.pushState(null, "", introQuestionPath(target));
    setQuestion(target);
    window.scrollTo(0, 0);
  }

  function update(patch: Partial<IntroAnswers>) {
    setAnswers((current) => ({ ...current, ...patch }));
  }

  const intents = answers.intents ?? [];
  const common = {
    current: index + 1,
    total: INTRO_QUESTIONS.length,
    onBack: previous ? () => goTo(previous) : () => (window.location.href = INTRO_BASE_PATH),
    onSkip: () => goTo(next, readIntroAnswers()),
    onSubmit: () => goTo(next),
    submitLabel: next ? fr.onboarding.continue : fr.intro.finish,
  };

  switch (question) {
    case "who":
      return (
        <OnboardingLayout
          {...common}
          title={fr.intro.whoTitle}
          subtitle={fr.intro.whoSubtitle}
          disabledReason={answers.role ? null : fr.onboarding.roleRequired}
        >
          <RadioList
            name="role"
            label={fr.intro.whoLabel}
            options={WHO_OPTIONS}
            value={answers.role ?? ""}
            onChange={(value) => update({ role: value as ProfileRole })}
          />
        </OnboardingLayout>
      );
    case "domains":
      return asksForDomains(answers) ? (
        <OnboardingLayout
          {...common}
          title={fr.intro.domainsTitle}
          subtitle={fr.intro.domainsSubtitle}
          disabledReason={answers.interests?.length ? null : fr.onboarding.interestsRequired}
        >
          <InterestChips
            value={answers.interests ?? []}
            onChange={(value: Interest[]) => update({ interests: value })}
          />
        </OnboardingLayout>
      ) : (
        <OnboardingLayout
          {...common}
          title={fr.intro.seekingTitle}
          subtitle={fr.intro.seekingSubtitle}
          disabledReason={intents.some((intent) => (SEEKING_OPTIONS as readonly Intent[]).includes(intent)) ? null : fr.intro.choiceRequired}
        >
          <ChoiceChips
            label={fr.intro.seekingLabel}
            options={SEEKING_OPTIONS}
            labels={fr.intro.intents}
            value={intents.filter((intent) => (SEEKING_OPTIONS as readonly Intent[]).includes(intent)) as (typeof SEEKING_OPTIONS)[number][]}
            onChange={(value) => update({ intents: replaceIntents(intents, SEEKING_OPTIONS, value) })}
          />
        </OnboardingLayout>
      );
    case "country":
      return (
        <OnboardingLayout
          {...common}
          title={fr.intro.countryTitle}
          subtitle={fr.intro.countrySubtitle}
          disabledReason={answers.country ? null : fr.onboarding.countryRequired}
        >
          <CountryList value={answers.country ?? ""} onChange={(country) => update({ country })} />
        </OnboardingLayout>
      );
    case "intents":
      return (
        <OnboardingLayout
          {...common}
          title={fr.intro.intentsTitle}
          subtitle={fr.intro.intentsSubtitle}
          disabledReason={intents.some((intent) => (GOAL_OPTIONS as readonly Intent[]).includes(intent)) ? null : fr.intro.choiceRequired}
        >
          <ChoiceChips
            label={fr.intro.intentsLabel}
            options={GOAL_OPTIONS}
            labels={fr.intro.intents}
            value={intents.filter((intent) => (GOAL_OPTIONS as readonly Intent[]).includes(intent)) as (typeof GOAL_OPTIONS)[number][]}
            onChange={(value) => update({ intents: replaceIntents(intents, GOAL_OPTIONS, value) })}
          />
        </OnboardingLayout>
      );
  }
}
