import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { SIDE_PANEL_ID, useSidePanel } from "./sidePanel.js";

export interface SidePanelColumnProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Panneau latéral du bureau, à côté de la barre d'activité. Replié, il
 * reste dans la page mais sort de l'ordre de tabulation (`invisible`), et
 * le focus qu'il contenait revient à l'icône de sa section.
 */
export function SidePanelColumn({ title, children, footer }: SidePanelColumnProps) {
  const { open } = useSidePanel();
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (open || !ref.current?.contains(document.activeElement)) return;
    document.querySelector<HTMLElement>("[data-activity-current]")?.focus();
  }, [open]);

  return (
    <aside
      ref={ref}
      id={SIDE_PANEL_ID}
      aria-label={title}
      className={cn(
        "sticky top-0 hidden h-viewport shrink-0 overflow-hidden border-border-strong bg-surface lg:block",
        "transition-[width,visibility] duration-150 motion-reduce:transition-none",
        open ? "visible w-side-panel border-r" : "invisible w-0",
      )}
    >
      <div className="flex h-full w-side-panel flex-col">
        <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
          <h2 className="truncate text-md font-semibold text-text">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-2 py-3">{footer}</div>}
      </div>
    </aside>
  );
}
