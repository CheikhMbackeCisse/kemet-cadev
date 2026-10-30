import type { ReactNode } from "react";
import { MobileTabBar } from "../shell/MobileTabBar.js";
import { SpaceRail } from "../shell/SpaceRail.js";
import { MOBILE_TABS, mobileTabHref } from "../shell/mobileTabs.js";
import { useSession } from "../../session/SessionProvider.js";
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
        {children}
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
