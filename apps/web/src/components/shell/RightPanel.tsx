import type { ReactNode } from "react";

export interface RightPanelProps {
  title: string;
  children: ReactNode;
}

/**
 * Colonne de droite sur grand ecran, toujours affichee, sans bouton de
 * fermeture. Sous lg, la feuille d'AppShell prend le relais.
 */
export function RightPanel({ title, children }: RightPanelProps) {
  return (
    <aside
      aria-label={title}
      className="sticky top-0 hidden h-viewport w-panel shrink-0 flex-col border-l border-border bg-surface lg:flex"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <h2 className="truncate text-md font-semibold text-text">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
