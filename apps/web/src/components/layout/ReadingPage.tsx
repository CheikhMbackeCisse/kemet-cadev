import type { ReactNode } from "react";
import { ErrorState } from "../ui/ErrorState.js";
import { MobileTabBar } from "../shell/MobileTabBar.js";
import { SpaceRail } from "../shell/SpaceRail.js";
import { MOBILE_TABS, mobileTabHref } from "../shell/mobileTabs.js";
import { useSession } from "../../session/SessionProvider.js";
import { cn } from "../../lib/cn.js";

export interface ReadingPageState {
  kind: "loading" | "notFound" | "error";
  message?: string;
  retry?: { label: string; onClick: () => void };
}

export interface ReadingPageProps {
  header: ReactNode;
  /** Icône du rail à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Onglet mobile actif, quand il ne porte pas le même identifiant que la section. */
  activeMobileTab?: string;
  state?: ReadingPageState;
  loadingSkeleton?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Pages de lecture (profil, post, projet…) : rail, conteneur de 960px,
 * en-tête propre à chaque écran et états chargement, introuvable et erreur.
 * Sous `lg`, la barre d'onglets remplace le rail.
 */
export function ReadingPage({
  header,
  activeSection,
  activeMobileTab,
  state,
  loadingSkeleton,
  className,
  children,
}: ReadingPageProps) {
  const { profile } = useSession();
  const activeTab = activeMobileTab ?? activeSection ?? "";

  return (
    <div className="flex min-h-screen w-full bg-bg">
      <SpaceRail activeSection={activeSection} />
      <main
        className={cn(
          "mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8",
          "pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-8",
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
      <MobileTabBar
        tabs={MOBILE_TABS}
        activeTabId={activeTab}
        onSelect={(id) => {
          if (id !== activeTab) window.location.href = mobileTabHref(id, profile?.handle ?? null);
        }}
      />
    </div>
  );
}
