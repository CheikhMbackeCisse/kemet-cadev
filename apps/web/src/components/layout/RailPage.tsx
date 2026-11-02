import type { ReactNode } from "react";
import { mobileTabFor } from "../shell/mobileTabs.js";
import { AppFrame } from "./AppFrame.js";
import { cn } from "../../lib/cn.js";

export interface RailPageProps {
  /** Section de la barre d'activité à marquer comme active (voir `RAIL_NAV`). */
  activeSection?: string;
  /** Onglet mobile actif, quand il ne porte pas le même identifiant que la section. */
  activeMobileTab?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Pages pleines qui ne sont ni un salon ni une page de lecture (skills,
 * projets, compétitions, paramètres…), dans le cadre commun.
 */
export function RailPage({ activeSection, activeMobileTab, className, children }: RailPageProps) {
  const activeTab = activeMobileTab ?? mobileTabFor(activeSection ?? "");

  return (
    <AppFrame activeSection={activeSection} activeMobileTab={activeTab}>
      <main
        className={cn(
          "mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8",
          "pb-[calc(76px+var(--mobile-visitor-bar)+env(safe-area-inset-bottom))] lg:pb-8",
          className,
        )}
      >
        {children}
      </main>
    </AppFrame>
  );
}
