import { navigate } from "../lib/navigation/navigate.js";
import { useEffect, useLayoutEffect, useState } from "react";
import { releaseStaticWelcome } from "../lib/staticWelcome.js";
import { ArrivalLayout } from "../components/arrival/ArrivalLayout.js";
import { KemetWordmark } from "../components/ui/KemetWordmark.js";
import { LanguageSwitch } from "../components/ui/LanguageSwitch.js";
import { usePreloadNext } from "../lib/navigation/usePreloadNext.js";
import { markIntroSeen } from "../lib/intro/introStorage.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

// "Systalink" écrit comme leur nom : S majuscule, graisse moyenne, en blanc
// sur le fond bleu, comme sur leur propre page. Ni leur symbole ni leur police.
function PoweredBy() {
  return (
    <div className="flex items-center gap-4">
      <p className="flex items-baseline gap-1.5">
        <span className="text-xs text-auth-text-muted">{fr.intro.poweredBy}</span>
        <span className="text-sm font-medium text-auth-text">Systalink</span>
      </p>
      <LanguageSwitch tone="onDark" />
    </div>
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

  // La carte écrite dans index.html, peinte avant le JavaScript, reste la
  // carte visible : celle de React, invisible à la même place, ne sert qu'à
  // placer le décor. Remplacer l'une par l'autre compterait comme un nouvel
  // affichage, plus tardif, du plus grand élément de la page (LCP).
  // theme-init.js ne montre la carte statique, écrite en français, qu'à une
  // personne qui n'a pas choisi l'anglais.
  const [staticCard] = useState(
    () =>
      document.documentElement.hasAttribute("data-static-welcome") &&
      document.getElementById("static-welcome") !== null,
  );
  const busy = status === "loading" || signedIn;
  useLayoutEffect(() => {
    if (signedIn) releaseStaticWelcome();
  }, [signedIn]);
  useEffect(() => {
    if (!staticCard) return;
    const links = document.querySelectorAll("#static-welcome .sw-card a");
    links.forEach((link) => link.addEventListener("click", markIntroSeen));
    return () => links.forEach((link) => link.removeEventListener("click", markIntroSeen));
  }, [staticCard]);

  // Tant que la session n'est pas connue, la carte de React attend. Celle
  // d'index.html, elle, s'affiche déjà : une personne connectée sur un
  // navigateur qui n'a jamais vu l'accueil la voit passer avant d'être
  // redirigée, cas rare accepté pour un premier affichage sans attendre.
  return (
    <ArrivalLayout
      motion="rich"
      width="sm"
      clearCard
      showLogo={false}
      pageFooter={<PoweredBy />}
      busy={busy}
      contentHidden={staticCard}
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
