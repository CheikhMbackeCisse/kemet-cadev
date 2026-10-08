import { cn } from "../../lib/cn.js";
import type { MobileTabItem } from "./types.js";

export interface MobileTabBarProps {
  tabs: MobileTabItem[];
  activeTabId: string;
  onSelect: (id: string) => void;
}

export function MobileTabBar({ tabs, activeTabId, onSelect }: MobileTabBarProps) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          aria-current={tab.id === activeTabId ? "page" : undefined}
          className={cn(
            "flex h-control-mobile flex-1 flex-col items-center justify-center gap-0.5 text-xs",
            tab.id === activeTabId ? "text-primary" : "text-muted",
          )}
        >
          <tab.icon className="size-5" aria-hidden="true" />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
