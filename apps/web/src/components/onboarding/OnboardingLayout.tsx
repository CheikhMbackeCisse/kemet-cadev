import { ArrivalLayout } from "../arrival/ArrivalLayout.js";
import { IntroStepLayout, type IntroStepLayoutProps } from "../intro/IntroStepLayout.js";
import { Skeleton } from "../ui/Skeleton.js";
import { fr } from "../../i18n/fr.js";

export type OnboardingLayoutProps = IntroStepLayoutProps;

/**
 * Un écran d'onboarding après l'inscription : le même fond et la même carte
 * en verre dépoli que les questions d'avant l'inscription, une seule
 * question, Retour et Passer, sans texte sous le titre.
 */
export function OnboardingLayout(props: OnboardingLayoutProps) {
  // Une liste longue (pays) peut cacher pourquoi Continuer ne répond pas.
  return <IntroStepLayout width="lg" showDisabledReason {...props} />;
}

/** Pendant le chargement du compte : la place de la progression, du titre et des choix. */
export function OnboardingSkeleton() {
  return (
    <ArrivalLayout motion="calm" width="lg">
      <div role="status" aria-label={fr.onboarding.loading} className="flex flex-col gap-3">
        <Skeleton className="h-1 w-full bg-white/20" />
        <Skeleton className="mt-2 h-7 w-2/3 bg-white/20" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-11 w-full bg-auth-skeleton" />
        ))}
      </div>
    </ArrivalLayout>
  );
}
