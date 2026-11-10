import * as RadixTabs from "@radix-ui/react-tabs";
import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface TabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /**
   * "start" : onglets serrés à gauche. "centered" : onglets d'une vue
   * principale (le fil), centrés, plus grands, à largeur égale.
   */
  layout?: "start" | "centered";
}

// Le panneau actif est rendu hors de RadixTabs.Content : son Presence lit
// getComputedStyle au montage, ce qui forçait le recalcul de style de tout
// le contenu (0,42 s pour le fil en CPU x4).
export function Tabs({ items, value, onValueChange, className, layout = "start" }: TabsProps) {
  const centered = layout === "centered";
  const baseId = useId();
  const triggerId = (itemValue: string) => `${baseId}-tab-${itemValue}`;
  const panelId = (itemValue: string) => `${baseId}-panel-${itemValue}`;
  const active = items.find((item) => item.value === value);
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List
        className={cn(
          "flex items-end border-b border-border",
          centered ? "justify-center gap-2 [&>*]:after:h-[3px]" : "gap-5",
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            id={triggerId(item.value)}
            aria-controls={panelId(item.value)}
            className={cn(
              "relative -mb-px rounded-control text-muted transition-colors duration-150 hover:text-text",
              centered
                ? "h-12 min-w-0 max-w-48 flex-1 px-3 text-base font-semibold"
                : "h-control px-1 text-sm font-medium max-md:h-control-mobile",
              "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:opacity-0",
              "data-[state=active]:text-text data-[state=active]:after:opacity-100",
            )}
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {active && (
        <div
          role="tabpanel"
          id={panelId(active.value)}
          aria-labelledby={triggerId(active.value)}
          tabIndex={0}
          className="pt-4"
        >
          {active.content}
        </div>
      )}
    </RadixTabs.Root>
  );
}
