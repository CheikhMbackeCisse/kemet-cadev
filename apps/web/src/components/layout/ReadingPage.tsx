import type { ReactNode } from "react";
import { ErrorState } from "../ui/ErrorState.js";
import { mobileTabFor } from "../shell/mobileTabs.js";
import { AppFrame } from "./AppFrame.js";
import { cn } from "../../lib/cn.js";

export interface ReadingPageState {
  kind: "loading" | "notFound" | "error";
  message?: string;
  retry?: { label: string; onClick: () => void };
}

export interface ReadingPageProps {
  header: ReactNode;
  /** Section de la barre d'activité à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Onglet mobile actif, quand il ne porte pas le même identifiant que la section. */
  activeMobileTab?: string;
  state?: ReadingPageState;
  loadingSkeleton?: ReactNode;
  /** "feed" : colonne d'environ 640 px du fil et de ses posts. */
  width?: "reading" | "feed";
  className?: string;
  children?: ReactNode;
}

/**
 * Pages de lecture (profil, post, projet…) : conteneur de 960px dans le
 * cadre commun, en-tête propre à chaque écran et états chargement,
 * introuvable et erreur.
 */
export function ReadingPage({
  header,
  activeSection,
  activeMobileTab,
  state,
  loadingSkeleton,
  width = "reading",
  className,
  children,
}: ReadingPageProps) {
  const activeTab = activeMobileTab ?? mobileTabFor(activeSection ?? "");

  return (
    <AppFrame activeSection={activeSection} activeMobileTab={activeTab}>
      <main
        className={cn(
          "mx-auto flex w-full flex-col",
          width === "feed" ? "max-w-[640px]" : "max-w-reading",
          "gap-6 px-4 pt-3 lg:pt-6",
          "pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8",
          className,
        )}
      >
        {header}
        {state?.kind === "loading" ? (
          loadingSkeleton
        ) : state?.kind === "notFound" || state?.kind === "error" ? (
          <ErrorState message={state.message ?? ""} retry={state.retry} />
        ) : (
          children
        )}
      </main>
    </AppFrame>
  );
}
