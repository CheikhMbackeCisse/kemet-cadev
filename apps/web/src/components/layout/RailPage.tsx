import type { ReactNode } from "react";
import { MobileTabBar } from "../shell/MobileTabBar.js";
import { SpaceRail } from "../shell/SpaceRail.js";
import { mobileTabFor } from "../shell/mobileTabs.js";
import { cn } from "../../lib/cn.js";

export interface RailPageProps {
  /** Icône du rail à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Onglet mobile actif, quand il ne porte pas le même identifiant que la section. */
  activeMobileTab?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Pages pleines qui ne sont ni un salon ni une page de lecture (skills,
 * projets, compétitions, paramètres…), avec le rail. Sous `lg`, la barre
 * d'onglets le remplace.
 */
export function RailPage({ activeSection, activeMobileTab, className, children }: RailPageProps) {
  const activeTab = activeMobileTab ?? mobileTabFor(activeSection ?? "");

  return (
    <div className="flex min-h-viewport w-full bg-bg">
      <SpaceRail activeSection={activeSection} />
      <main
        className={cn(
          "mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8",
          "pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8",
          className,
        )}
      >
        {children}
      </main>
      <MobileTabBar activeTabId={activeTab} />
    </div>
  );
}
