import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { isSlowConnection } from "../../lib/network.js";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { markIntroSeen } from "../../lib/intro/introStorage.js";
import { ArrivalBackground, type ArrivalMotion } from "./ArrivalBackground.js";
import { ArrivalDecorBand } from "./ArrivalDecor.js";

export interface ArrivalLayoutProps {
  motion: ArrivalMotion;
  /** Largeur de la carte : "md" pour un formulaire, "lg" pour une grille de choix. */
  width?: "md" | "lg";
  /** Posé à droite du logo, comme le lien de retour vers l'application. */
  headerEnd?: ReactNode;
  /** Sous la carte, sur le fond. */
  footer?: ReactNode;
  /** Tout en bas de l'écran, hors de la carte. */
  pageFooter?: ReactNode;
  /** Faux sur l'accueil, où le logo complet est déjà sur la carte. */
  showLogo?: boolean;
  busy?: boolean;
  children: ReactNode;
}

// public/theme-init.js pose ce fond sombre avant le premier affichage ; il
// doit suivre le parcours quand on en sort sans recharger le document.
function useArrivalDocumentBackground() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-arrival", "");
    return () => document.documentElement.removeAttribute("data-arrival");
  }, []);
}

/** Vrai tant que l'onglet est visible : un fond animé caché ne doit rien coûter. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * Gabarit du parcours d'arrivée : fond de marque, logo en haut, contenu sur
 * une carte en verre dépoli au centre, entre deux bandes de décor. Le texte
 * de la carte est blanc dans les deux thèmes, le fond restant sombre ; les
 * champs gardent leurs couleurs ordinaires.
 * Sur connexion lente ou en économie de données, rien ne bouge : le
 * téléphone a déjà assez à faire avec le téléchargement de la page.
 */
export function ArrivalLayout({
  motion,
  width = "md",
  headerEnd,
  footer,
  pageFooter,
  showLogo = true,
  busy,
  children,
}: ArrivalLayoutProps) {
  useArrivalDocumentBackground();
  const visible = usePageVisible();
  const [still] = useState(isSlowConnection);
  const hasHeader = showLogo || headerEnd !== undefined;

  return (
    <div
      className="arrival-root relative flex min-h-viewport w-full flex-col"
      data-paused={visible ? undefined : ""}
      data-still={still ? "" : undefined}
      aria-busy={busy || undefined}
    >
      <ArrivalBackground motion={motion} />

      {hasHeader ? (
        <header className="auth-on-dark relative z-10 flex w-full items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          {showLogo ? (
            <a
              href="/fil"
              onClick={markIntroSeen}
              className="kemet-on-dark flex min-h-control-mobile items-center md:min-h-control"
            >
              <KemetWordmark className="h-6 w-auto" />
            </a>
          ) : (
            <span />
          )}
          {headerEnd}
        </header>
      ) : (
        // Même hauteur que le pied de page : la carte reste au centre exact
        // de l'écran, sur le continent.
        pageFooter && <div aria-hidden="true" className="arrival-footer-space" />
      )}

      {!busy && (
        <div
          className={cn(
            "arrival-stage relative z-10 flex-1",
            width === "lg" ? "arrival-stage-lg" : "arrival-stage-md",
          )}
        >
          <ArrivalDecorBand side="start" motion={motion} />
          <main className="flex min-w-0 flex-col items-center justify-center px-4 py-4 sm:py-8">
            <div className="flex w-full flex-col gap-3">
              <div
                className={cn(
                  "arrival-glass auth-on-dark flex flex-col gap-4 rounded-panel p-5 text-auth-text sm:p-8",
                  motion === "rich" && "arrival-glass-clear",
                )}
              >
                {children}
              </div>
              {footer && <div className="auth-on-dark">{footer}</div>}
            </div>
          </main>
          <ArrivalDecorBand side="end" motion={motion} />
        </div>
      )}
      {!busy && pageFooter && (
        <footer className="arrival-footer-space auth-on-dark relative z-10 flex items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
          {pageFooter}
        </footer>
      )}
    </div>
  );
}
