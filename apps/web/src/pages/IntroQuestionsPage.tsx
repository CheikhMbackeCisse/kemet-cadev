import { useEffect, useState } from "react";
import type { Intent, Interest, ProfileRole } from "@kemet/shared";
import { IntroStepLayout } from "../components/intro/IntroStepLayout.js";
import { CountryList } from "../components/onboarding/CountryList.js";
import { DomainGrid } from "../components/onboarding/DomainGrid.js";
import { OtherAnswerField } from "../components/onboarding/OtherAnswerField.js";
import { CheckList, RadioList, type ChoiceOption } from "../components/onboarding/RadioList.js";
import { INTENT_ICONS, WHO_ICONS } from "../lib/onboarding/choiceIcons.js";
import {
  asksForDomains,
  INTRO_BASE_PATH,
  INTRO_QUESTIONS,
  introQuestionPath,
  questionFromPath,
  type IntroQuestion,
} from "../lib/intro/introSteps.js";
import {
  markIntroSeen,
  readIntroAnswers,
  saveIntroAnswers,
  type IntroAnswers,
} from "../lib/intro/introStorage.js";
import { SIGN_UP_PATH } from "../session/signUpInvite.js";
import { fr } from "../i18n/fr.js";

const WHO_OPTIONS = [
  { value: "developer", label: fr.intro.whoDeveloper, icon: WHO_ICONS.developer },
  { value: "student", label: fr.intro.whoStudent, icon: WHO_ICONS.student },
  { value: "hr", label: fr.intro.whoHr, icon: WHO_ICONS.hr },
  { value: "entrepreneur", label: fr.intro.whoEntrepreneur, icon: WHO_ICONS.entrepreneur },
  { value: "other", label: fr.intro.whoOther, icon: WHO_ICONS.other },
] satisfies (ChoiceOption & { value: ProfileRole })[];

const SEEKING_OPTIONS = [
  "recruit",
  "find_partner",
  "follow_community",
] as const satisfies readonly Intent[];
const GOAL_OPTIONS = [
  "learn",
  "help_others",
  "showcase_work",
  "recruit",
] as const satisfies readonly Intent[];

function intentOptions(intents: readonly Intent[]) {
  return intents.map((intent) => ({
    value: intent,
    label: fr.intro.intents[intent],
    icon: INTENT_ICONS[intent],
  }));
}

/** Remplace, dans la liste des intentions, celles qu'un écran propose, sans toucher aux autres. */
function replaceIntents(current: Intent[], offered: readonly Intent[], chosen: Intent[]): Intent[] {
  return [...new Set([...current.filter((intent) => !offered.includes(intent)), ...chosen])];
}

/** Une précision "Autre" n'a plus de sens une fois "Autre" décoché. */
function withoutStaleOther(answers: IntroAnswers): IntroAnswers {
  const { roleOther, interestOther, ...rest } = answers;
  return {
    ...rest,
    ...(answers.role === "other" && roleOther !== undefined && { roleOther }),
    ...(answers.interests?.includes("other") && interestOther !== undefined && { interestOther }),
  };
}

/**
 * Quatre questions posées à un visiteur avant l'inscription. Les réponses
 * restent dans le navigateur ; elles rejoignent le profil une fois le compte
 * créé (OnboardingPage).
 */
export function IntroQuestionsPage() {
  const [question, setQuestion] = useState<IntroQuestion>(
    () => questionFromPath(window.location.pathname) ?? "who",
  );
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
    saveIntroAnswers(withoutStaleOther(updated));
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
        <IntroStepLayout
          {...common}
          title={fr.intro.whoTitle}
          disabledReason={answers.role ? null : fr.onboarding.roleRequired}
        >
          <RadioList
            name="role"
            label={fr.intro.whoLabel}
            options={WHO_OPTIONS}
            value={answers.role ?? ""}
            onChange={(value) => update({ role: value as ProfileRole })}
            tone="glass"
          />
          {answers.role === "other" && (
            <OtherAnswerField
              label={fr.intro.whoOtherLabel}
              placeholder={fr.intro.whoOtherPlaceholder}
              value={answers.roleOther ?? ""}
              onChange={(roleOther) => update({ roleOther })}
              tone="glass"
            />
          )}
        </IntroStepLayout>
      );
    case "domains":
      return asksForDomains(answers) ? (
        <IntroStepLayout
          {...common}
          width="lg"
          title={fr.intro.domainsTitle}
          disabledReason={answers.interests?.length ? null : fr.onboarding.interestsRequired}
        >
          <DomainGrid
            value={answers.interests ?? []}
            onChange={(value: Interest[]) => update({ interests: value })}
            tone="glass"
          />
          {answers.interests?.includes("other") && (
            <OtherAnswerField
              label={fr.onboarding.interestOtherLabel}
              placeholder={fr.onboarding.interestOtherPlaceholder}
              value={answers.interestOther ?? ""}
              onChange={(interestOther) => update({ interestOther })}
              tone="glass"
            />
          )}
        </IntroStepLayout>
      ) : (
        <IntroStepLayout
          {...common}
          title={fr.intro.seekingTitle}
          disabledReason={
            intents.some((intent) => (SEEKING_OPTIONS as readonly Intent[]).includes(intent))
              ? null
              : fr.intro.choiceRequired
          }
        >
          <CheckList
            label={fr.intro.seekingLabel}
            options={intentOptions(SEEKING_OPTIONS)}
            value={intents.filter((intent) =>
              (SEEKING_OPTIONS as readonly Intent[]).includes(intent),
            )}
            onChange={(value) =>
              update({ intents: replaceIntents(intents, SEEKING_OPTIONS, value) })
            }
            tone="glass"
          />
        </IntroStepLayout>
      );
    case "country":
      return (
        <IntroStepLayout
          {...common}
          title={fr.intro.countryTitle}
          disabledReason={answers.country ? null : fr.onboarding.countryRequired}
        >
          <CountryList
            value={answers.country ?? ""}
            onChange={(country) => update({ country })}
            tone="glass"
          />
        </IntroStepLayout>
      );
    case "intents":
      return (
        <IntroStepLayout
          {...common}
          title={fr.intro.intentsTitle}
          disabledReason={
            intents.some((intent) => (GOAL_OPTIONS as readonly Intent[]).includes(intent))
              ? null
              : fr.intro.choiceRequired
          }
        >
          <CheckList
            label={fr.intro.intentsLabel}
            options={intentOptions(GOAL_OPTIONS)}
            value={intents.filter((intent) => (GOAL_OPTIONS as readonly Intent[]).includes(intent))}
            onChange={(value) => update({ intents: replaceIntents(intents, GOAL_OPTIONS, value) })}
            tone="glass"
          />
        </IntroStepLayout>
      );
  }
}
