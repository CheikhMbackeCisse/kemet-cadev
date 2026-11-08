import { useEffect } from "react";
import { ArrivalLayout } from "../components/arrival/ArrivalLayout.js";
import { KemetSymbol } from "../components/ui/KemetSymbol.js";
import { introQuestionPath } from "../lib/intro/introSteps.js";
import { markIntroSeen } from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

/**
 * Première arrivée d'un visiteur : le fond le plus animé du parcours, le
 * titre et deux actions sur la carte en verre dépoli.
 */
export function WelcomePage() {
  const { status } = useSession();
  const signedIn = status === "ready" || status === "incomplete";

  useEffect(() => {
    if (signedIn) {
      markIntroSeen();
      window.location.replace("/");
    }
  }, [signedIn]);

  // Tant que la session n'est pas connue, le fond seul : une personne
  // connectée ne doit pas voir l'accueil passer avant d'être redirigée.
  return (
    <ArrivalLayout motion="rich" width="lg" busy={status === "loading" || signedIn}>
      <div className="flex flex-col items-center gap-6 py-2 text-center sm:py-4">
        <span className="kemet-on-dark">
          <KemetSymbol className="h-20 w-auto md:h-24" />
        </span>
        <h1 className="text-xl font-extrabold md:text-hero">{fr.intro.welcomeTitle}</h1>
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
