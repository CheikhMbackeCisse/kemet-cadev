import { useEffect, useLayoutEffect, useState } from "react";
import { isSlowConnection } from "../../lib/network.js";
import { arrivalMotionFor } from "../../lib/navigation/arrival.js";
import { useSession } from "../../session/SessionProvider.js";
import { useAfterFirstPaint } from "../../lib/useAfterFirstPaint.js";
import { releaseStaticWelcome } from "../../lib/staticWelcome.js";
import { ArrivalBackground, type ArrivalMotion } from "./ArrivalBackground.js";

/** Vrai tant que l'onglet est visible : un fond animé caché ne doit rien coûter. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** Vrai sur connexion lente ou en économie de données : rien ne bouge. */
export function useStillBackground(): boolean {
  const [still] = useState(isSlowConnection);
  return still;
}

/**
 * Fond d'une page du parcours d'arrivée. Monté par le routeur, hors de la
 * page : il reste en place d'un écran du parcours à l'autre, seule la carte
 * change. public/theme-init.js en pose déjà la couleur avant le premier
 * affichage ; elle suit ici les changements de page sans rechargement.
 */
export function ArrivalBackdrop({ pathname }: { pathname: string }) {
  const { status } = useSession();
  // La racine d'une première visite mène à l'accueil, sauf pour un compte
  // connecté, qui va au fil.
  const motion: ArrivalMotion | null =
    pathname === "/" && status === "ready" ? null : arrivalMotionFor(pathname);
  const active = motion !== null;
  const visible = usePageVisible();
  const still = useStillBackground();
  const decorReady = useAfterFirstPaint();

  // L'accueil statique ne vaut que pour l'accueil : toute autre page le retire.
  const welcome = pathname === "/decouvrir" || (pathname === "/" && status !== "ready");
  useLayoutEffect(() => {
    if (!welcome) releaseStaticWelcome();
  }, [welcome]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute("data-arrival", "");
    else root.removeAttribute("data-arrival");
  }, [active]);
  useEffect(() => () => document.documentElement.removeAttribute("data-arrival"), []);

  // Le dégradé de base est déjà posé par index.html : continent, réseau et
  // halos arrivent après le premier affichage, en fondu.
  if (!motion || !decorReady) return null;
  return (
    <div
      className="arrival-root arrival-backdrop arrival-fade-in"
      data-paused={visible ? undefined : ""}
      data-still={still ? "" : undefined}
    >
      <ArrivalBackground motion={motion} />
    </div>
  );
}
