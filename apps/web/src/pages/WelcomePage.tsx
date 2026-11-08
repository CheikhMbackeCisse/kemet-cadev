import { navigate } from "../lib/navigation/navigate.js";
import { useEffect } from "react";
import { ArrivalLayout } from "../components/arrival/ArrivalLayout.js";
import { KemetWordmark } from "../components/ui/KemetWordmark.js";
import { introQuestionPath } from "../lib/intro/introSteps.js";
import { markIntroSeen } from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

// Couleur principale de Systalink (#1265dd, la même que le bleu de Kemet),
// écrite sur une pastille blanche : directement sur le bleu nuit, elle ne
// serait pas lisible. Le nom en texte, sans leur logo ni leur police.
function PoweredBy() {
  return (
    <p className="flex items-center gap-2 text-sm text-auth-text">
      {fr.intro.poweredBy}
      <span className="rounded-full bg-white px-2.5 py-0.5 font-bold tracking-tight text-[#1265dd]">
        Systalink
      </span>
    </p>
  );
}

/**
 * Première arrivée d'un visiteur : le continent et le réseau de ses
 * capitales au centre, le logo, le titre et deux actions sur la carte en
 * verre dépoli.
 */
export function WelcomePage() {
  const { status } = useSession();
  const signedIn = status === "ready" || status === "incomplete";

  useEffect(() => {
    if (signedIn) {
      markIntroSeen();
      navigate("/", { replace: true });
    }
  }, [signedIn]);

  // Tant que la session n'est pas connue, le fond seul : une personne
  // connectée ne doit pas voir l'accueil passer avant d'être redirigée.
  return (
    <ArrivalLayout
      motion="rich"
      width="md"
      showLogo={false}
      placement="bottom"
      pageFooter={<PoweredBy />}
      busy={status === "loading" || signedIn}
    >
      <div className="flex flex-col items-center gap-4 text-center sm:gap-5">
        <span className="kemet-on-dark">
          <KemetWordmark className="h-8 w-auto md:h-10" />
        </span>
        <h1 className="text-balance text-xl font-bold leading-tight">{fr.intro.welcomeTitle}</h1>
        <div className="flex w-full flex-col items-center gap-2">
          <a
            href={introQuestionPath("who")}
            className="inline-flex h-control-mobile w-full items-center justify-center rounded-control bg-auth-text px-6 text-base font-semibold text-[var(--auth-bg-to)] hover:bg-auth-button-hover md:h-control md:w-auto md:min-w-48"
          >
            {fr.intro.start}
          </a>
          <a
            href="/fil"
            onClick={markIntroSeen}
            className="inline-flex min-h-control-mobile items-center px-2 text-base font-medium text-auth-text-muted underline-offset-4 hover:text-auth-text hover:underline md:min-h-control"
          >
            {fr.intro.explore}
          </a>
        </div>
      </div>
    </ArrivalLayout>
  );
}
