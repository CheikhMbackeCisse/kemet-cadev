import { useLayoutEffect, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { markIntroSeen } from "../../lib/intro/introStorage.js";
import { ArrivalBackground, type ArrivalMotion } from "./ArrivalBackground.js";

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
  /** "bottom" : carte en bas de l'écran, pour laisser voir le continent. */
  placement?: "center" | "bottom";
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

/**
 * Gabarit du parcours d'arrivée : fond animé, logo en haut, contenu sur une
 * carte en verre dépoli. Le texte de la carte est blanc dans les deux thèmes,
 * le fond restant sombre ; les champs gardent leurs couleurs ordinaires.
 */
export function ArrivalLayout({
  motion,
  width = "md",
  headerEnd,
  footer,
  pageFooter,
  showLogo = true,
  placement = "center",
  busy,
  children,
}: ArrivalLayoutProps) {
  useArrivalDocumentBackground();
  return (
    <div className="relative flex min-h-viewport w-full flex-col" aria-busy={busy || undefined}>
      <ArrivalBackground motion={motion} />

      {(showLogo || headerEnd) && (
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
      )}

      {!busy && (
        <main
          className={cn(
            "relative z-10 flex flex-1 flex-col items-center px-4 py-4 sm:py-8",
            placement === "bottom" ? "justify-end" : "justify-center",
          )}
        >
          <div
            className={cn("flex w-full flex-col gap-3", width === "lg" ? "max-w-2xl" : "max-w-md")}
          >
            <div className="arrival-glass auth-on-dark flex flex-col gap-4 rounded-panel p-5 text-auth-text sm:p-8">
              {children}
            </div>
            {footer && <div className="auth-on-dark">{footer}</div>}
          </div>
        </main>
      )}
      {!busy && pageFooter && (
        <footer className="auth-on-dark relative z-10 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {pageFooter}
        </footer>
      )}
    </div>
  );
}
