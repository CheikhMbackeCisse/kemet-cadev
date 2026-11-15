import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useLayoutEffect } from "react";
import { releaseStaticWelcome } from "../lib/staticWelcome.js";
import { ArrivalLayout } from "../components/arrival/ArrivalLayout.js";
import { KemetWordmark } from "../components/ui/KemetWordmark.js";
import { usePreloadNext } from "../lib/navigation/usePreloadNext.js";
import { markIntroSeen } from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

// "Systalink" écrit comme leur nom : S majuscule, graisse moyenne, en blanc
// sur le fond bleu, comme sur leur propre page. Ni leur symbole ni leur police.
function PoweredBy() {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-xs text-auth-text-muted">{fr.intro.poweredBy}</span>
      <span className="text-sm font-medium text-auth-text">Systalink</span>
    </p>
  );
}

/**
 * Première arrivée d'un visiteur : la carte en verre au centre de l'écran,
 * sur le continent en filigrane, avec le logo, le titre et deux actions.
 */
export function WelcomePage() {
  const { status } = useSession();
  usePreloadNext("/inscription", "/fil");
  const signedIn = status === "ready" || status === "incomplete";

  useEffect(() => {
    if (signedIn) {
      markIntroSeen();
      navigate("/", { replace: true });
    }
  }, [signedIn]);

  // La carte de React est à la place exacte de celle d'index.html : celle-ci
  // part dans le même affichage, sans saut.
  const busy = status === "loading" || signedIn;
  useLayoutEffect(() => {
    if (!busy || signedIn) releaseStaticWelcome();
  }, [busy, signedIn]);

  // Tant que la session n'est pas connue, le fond seul : une personne
  // connectée ne doit pas voir l'accueil passer avant d'être redirigée.
  return (
    <ArrivalLayout
      motion="rich"
      width="sm"
      clearCard
      showLogo={false}
      pageFooter={<PoweredBy />}
      busy={busy}
    >
      <div className="flex flex-col items-center gap-3 text-center sm:gap-5">
        <span className="kemet-on-dark">
          <KemetWordmark className="h-7 w-auto md:h-10" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-balance text-lg font-bold leading-tight min-[375px]:text-xl">
            {fr.intro.welcomeTitle}
          </h1>
          <p className="text-balance text-sm text-auth-text-muted md:text-base">
            {fr.intro.welcomePromise}
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <a
            href="/inscription"
            onClick={markIntroSeen}
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
