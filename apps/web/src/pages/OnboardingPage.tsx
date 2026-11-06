import { useEffect, useState } from "react";
import { ONBOARDING_STEPS, type Interest, type OnboardingStep, type ProfileRole } from "@kemet/shared";
import { OnboardingLayout } from "../components/onboarding/OnboardingLayout.js";
import { CountryList } from "../components/onboarding/CountryList.js";
import { RadioList } from "../components/onboarding/RadioList.js";
import { InterestChips } from "../components/onboarding/InterestChips.js";
import { SpaceSuggestions } from "../components/onboarding/SpaceSuggestions.js";
import { PeopleSuggestions } from "../components/onboarding/PeopleSuggestions.js";
import { Input } from "../components/ui/Input.js";
import { updateMyProfile, updateOnboarding } from "../lib/chat/api.js";
import { PROFILE_ROLE_OPTIONS } from "../lib/profileRoles.js";
import { nextStep, onboardingPath, previousStep, stepFromPath, stepIndex } from "../lib/onboarding/steps.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const FEED_PATH = "/fil";

/**
 * Six écrans, une question chacun. Chaque passage d'un écran à l'autre
 * enregistre l'écran atteint, pour qu'un compte qui revient reprenne là ;
 * le dernier marque le parcours terminé, et on n'y revient plus.
 */
export function OnboardingPage() {
  const { status, profile, onboarding } = useSession();
  const [step, setStep] = useState<OnboardingStep | null>(() => stepFromPath(window.location.pathname));
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [interests, setInterests] = useState<Interest[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "visitor") window.location.href = "/connexion";
    if (status === "incomplete") window.location.href = "/completer-profil";
    if (status === "ready" && onboarding?.completed) window.location.replace(FEED_PATH);
  }, [status, onboarding]);

  useEffect(() => {
    if (initialized || status !== "ready" || !profile || !onboarding) return;
    setCountry(profile.country);
    setRole(profile.role ?? "");
    setSpecialty(profile.title ?? "");
    setInterests(onboarding.interests);
    if (!step) {
      window.history.replaceState(null, "", onboardingPath(onboarding.step));
      setStep(onboarding.step);
    }
    setInitialized(true);
  }, [initialized, status, profile, onboarding, step]);

  useEffect(() => {
    function handlePopState() {
      setError(null);
      setStep(stepFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!initialized || !step || !profile) return null;

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
  const next = nextStep(current);
  const back = previousStep(current);
  const common = {
    current: stepIndex(current) + 1,
    total: ONBOARDING_STEPS.length,
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
          subtitle={fr.onboarding.countrySubtitle}
          disabledReason={country ? null : fr.onboarding.countryRequired}
          onSubmit={() =>
            void goTo(next, () => updateMyProfile({ country }))
          }
        >
          <CountryList value={country} onChange={setCountry} />
        </OnboardingLayout>
      );
    case "role":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.roleTitle}
          subtitle={fr.onboarding.roleSubtitle}
          disabledReason={role ? null : fr.onboarding.roleRequired}
          onSubmit={() => void goTo(next, () => updateMyProfile({ role: role as ProfileRole }))}
        >
          <RadioList
            name="role"
            label={fr.auth.roleLabel}
            options={PROFILE_ROLE_OPTIONS}
            value={role}
            onChange={setRole}
          />
        </OnboardingLayout>
      );
    case "specialty":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.specialtyTitle}
          subtitle={fr.onboarding.specialtySubtitle}
          disabledReason={specialty.trim() ? null : fr.onboarding.specialtyRequired}
          onSubmit={() => void goTo(next, () => updateMyProfile({ title: specialty.trim() }))}
        >
          <label className="flex flex-col gap-1 text-sm text-text-2">
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
          subtitle={fr.onboarding.interestsSubtitle}
          disabledReason={interests.length > 0 ? null : fr.onboarding.interestsRequired}
          onSubmit={() => void goTo(next, () => updateOnboarding({ interests }))}
        >
          <InterestChips value={interests} onChange={setInterests} />
        </OnboardingLayout>
      );
    case "spaces":
      return (
        <OnboardingLayout
          {...common}
          title={fr.onboarding.spacesTitle}
          subtitle={fr.onboarding.spacesSubtitle}
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
          subtitle={fr.onboarding.peopleSubtitle}
          onSubmit={() => void goTo(next)}
        >
          <PeopleSuggestions onError={setError} />
        </OnboardingLayout>
      );
  }
}
