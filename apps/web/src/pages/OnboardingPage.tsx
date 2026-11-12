import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useState } from "react";
import {
  ONBOARDING_STEPS,
  ROLES_WITH_DETAIL,
  type Interest,
  type OnboardingStep,
  type ProfileRole,
  type ProfileWorkMode,
} from "@kemet/shared";
import { OnboardingLayout, OnboardingSkeleton } from "../components/onboarding/OnboardingLayout.js";
import { CountryList } from "../components/onboarding/CountryList.js";
import { RadioList } from "../components/onboarding/RadioList.js";
import { DomainGrid } from "../components/onboarding/DomainGrid.js";
import { OtherAnswerField } from "../components/onboarding/OtherAnswerField.js";
import { SpaceSuggestions } from "../components/onboarding/SpaceSuggestions.js";
import { PeopleSuggestions } from "../components/onboarding/PeopleSuggestions.js";
import { Input } from "../components/ui/Input.js";
import { RoleDetailFields, roleDetailTitle } from "../components/profile/RoleDetailFields.js";
import { updateMyProfile, updateOnboarding } from "../lib/chat/api.js";
import { PROFILE_ROLE_OPTIONS } from "../lib/profileRoles.js";
import { onboardingPath, stepFromPath, stepIndex } from "../lib/onboarding/steps.js";
import {
  clearIntroAnswers,
  hasIntroAnswers,
  readIntroAnswers,
  type IntroAnswers,
} from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const FEED_PATH = "/fil";

function hasRoleDetail(role: string): boolean {
  return (ROLES_WITH_DETAIL as readonly string[]).includes(role);
}

/** Écrans déjà répondus avant l'inscription, sur l'écran d'accueil. */
function stepsAnsweredByIntro(answers: IntroAnswers): Set<OnboardingStep> {
  const answered = new Set<OnboardingStep>();
  if (answers.country) answered.add("country");
  if (answers.role) answered.add("role");
  if (answers.interests?.length) answered.add("interests");
  return answered;
}

// Les réponses de l'accueil rejoignent le profil une seule fois, puis
// quittent le navigateur.
async function applyIntroAnswers(answers: IntroAnswers): Promise<void> {
  if (answers.country || answers.role) {
    await updateMyProfile({
      ...(answers.country && { country: answers.country }),
      ...(answers.role && { role: answers.role }),
    });
  }
  if (answers.interests?.length || answers.intents?.length || answers.roleOther) {
    await updateOnboarding({
      ...(answers.interests?.length && { interests: answers.interests }),
      ...(answers.interestOther && { interestOther: answers.interestOther }),
      ...(answers.intents?.length && { intents: answers.intents }),
      ...(answers.roleOther && { roleOther: answers.roleOther }),
    });
  }
  clearIntroAnswers();
}

/**
 * Six écrans, une question chacun. Chaque passage d'un écran à l'autre
 * enregistre l'écran atteint, pour qu'un compte qui revient reprenne là ;
 * le dernier marque le parcours terminé, et on n'y revient plus.
 */
export function OnboardingPage() {
  const { status, profile, onboarding } = useSession();
  const [step, setStep] = useState<OnboardingStep | null>(() =>
    stepFromPath(window.location.pathname),
  );
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [workMode, setWorkMode] = useState<ProfileWorkMode | null>(null);
  const [organization, setOrganization] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [interestOther, setInterestOther] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [skipped, setSkipped] = useState<Set<OnboardingStep>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "visitor") navigate("/connexion", { replace: true });
    if (status === "incomplete") navigate("/completer-profil", { replace: true });
    if (status === "ready" && onboarding?.completed) navigate(FEED_PATH, { replace: true });
  }, [status, onboarding]);

  useEffect(() => {
    if (initialized || status !== "ready" || !profile || !onboarding) return;
    const intro = readIntroAnswers();
    const fromIntro = hasIntroAnswers(intro);
    let cancelled = false;

    function start(answeredByIntro: Set<OnboardingStep>) {
      if (cancelled || !profile || !onboarding) return;
      const startRole = intro.role ?? profile.role ?? "";
      // Sans rôle à préciser, l'écran de précision ne doit jamais servir de reprise.
      const answered = hasRoleDetail(startRole)
        ? answeredByIntro
        : new Set([...answeredByIntro, "role_detail" as const]);
      setSkipped(answeredByIntro);
      setCountry(intro.country ?? profile.country);
      setRole(startRole);
      setWorkMode(profile.workMode);
      setOrganization(profile.organization ?? "");
      setSpecialty(profile.title ?? "");
      setInterests(intro.interests?.length ? intro.interests : onboarding.interests);
      setInterestOther(intro.interestOther ?? onboarding.interestOther ?? "");
      const requested = step ?? onboarding.step;
      const resume = answered.has(requested)
        ? (ONBOARDING_STEPS.slice(stepIndex(requested)).find(
            (candidate) => !answered.has(candidate),
          ) ?? "people")
        : requested;
      if (resume !== step) {
        window.history.replaceState(null, "", onboardingPath(resume));
        setStep(resume);
      }
      setInitialized(true);
    }

    if (!fromIntro) {
      start(new Set());
      return;
    }
    applyIntroAnswers(intro)
      .then(() => start(stepsAnsweredByIntro(intro)))
      .catch(() => {
        setError(fr.onboarding.saveError);
        start(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [initialized, status, profile, onboarding, step]);

  useEffect(() => {
    function handlePopState() {
      setError(null);
      setStep(stepFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!initialized || !step || !profile) return <OnboardingSkeleton />;

  async function goTo(target: OnboardingStep | null, save?: () => Promise<unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      if (save) await save();
      if (target) {
        await updateOnboarding({ step: target });
        window.history.pushState(null, "", onboardingPath(target));
        setStep(target);
        window.scrollTo(0, 0);
      } else {
        await updateOnboarding({ completed: true });
        window.location.href = FEED_PATH;
      }
    } catch {
      setError(fr.onboarding.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  const current = step;
  // La précision n'a de question que pour quatre rôles : sinon l'écran n'existe pas.
  const visibleSteps = ONBOARDING_STEPS.filter(
    (candidate) =>
      (!skipped.has(candidate) || candidate === current) &&
      (candidate !== "role_detail" || hasRoleDetail(role)),
  );
  const position = visibleSteps.indexOf(current);
  const next = visibleSteps[position + 1] ?? null;
  const back = visibleSteps[position - 1] ?? null;
  const common = {
    current: position + 1,
    total: visibleSteps.length,
    onBack: back ? () => void goTo(back) : null,
    onSkip: () => void goTo(next),
    submitLabel: next ? fr.onboarding.continue : fr.onboarding.finish,
    submitting,
    error,
  };

  switch (current) {
    case "country":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.countryTitle}
          disabledReason={country ? null : fr.onboarding.countryRequired}
          onSubmit={() => void goTo(next, () => updateMyProfile({ country }))}
        >
          <CountryList value={country} onChange={setCountry} tone="glass" />
        </OnboardingLayout>
      );
    case "role":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.roleTitle}
          disabledReason={role ? null : fr.onboarding.roleRequired}
          onSubmit={() => void goTo(next, () => updateMyProfile({ role: role as ProfileRole }))}
        >
          <RadioList
            name="role"
            label={fr.auth.roleLabel}
            options={PROFILE_ROLE_OPTIONS}
            value={role}
            onChange={setRole}
            tone="glass"
          />
        </OnboardingLayout>
      );
    case "role_detail":
      return (
        <OnboardingLayout
          {...common}
          title={roleDetailTitle(role as ProfileRole)}
          onSubmit={() =>
            void goTo(next, () =>
              updateMyProfile({
                workMode,
                organization: organization.trim() || null,
              }),
            )
          }
        >
          <RoleDetailFields
            role={role as ProfileRole}
            workMode={workMode}
            organization={organization}
            onWorkModeChange={setWorkMode}
            onOrganizationChange={setOrganization}
            tone="glass"
          />
        </OnboardingLayout>
      );
    case "specialty":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.specialtyTitle}
          disabledReason={specialty.trim() ? null : fr.onboarding.specialtyRequired}
          onSubmit={() => void goTo(next, () => updateMyProfile({ title: specialty.trim() }))}
        >
          <label className="flex flex-col gap-1 text-sm text-auth-text">
            {fr.onboarding.specialtyLabel}
            <Input
              value={specialty}
              maxLength={120}
              placeholder={fr.onboarding.specialtyPlaceholder}
              onChange={(event) => setSpecialty(event.target.value)}
            />
          </label>
        </OnboardingLayout>
      );
    case "interests":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.interestsTitle}
          disabledReason={interests.length > 0 ? null : fr.onboarding.interestsRequired}
          onSubmit={() =>
            void goTo(next, () =>
              updateOnboarding({
                interests,
                interestOther:
                  interests.includes("other") && interestOther.trim() ? interestOther.trim() : null,
              }),
            )
          }
        >
          <DomainGrid value={interests} onChange={setInterests} tone="glass" />
          {interests.includes("other") && (
            <OtherAnswerField
              label={fr.onboarding.interestOtherLabel}
              placeholder={fr.onboarding.interestOtherPlaceholder}
              value={interestOther}
              onChange={setInterestOther}
              tone="glass"
            />
          )}
        </OnboardingLayout>
      );
    case "spaces":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.spacesTitle}
          onSubmit={() => void goTo(next)}
        >
          <SpaceSuggestions profileId={profile.id} onError={setError} />
        </OnboardingLayout>
      );
    case "people":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.peopleTitle}
          onSubmit={() => void goTo(next)}
        >
          <PeopleSuggestions onError={setError} />
        </OnboardingLayout>
      );
  }
}
