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
  /** Onglets plus larges que l'écran : la rangée défile au doigt. */
  scrollable?: boolean;
}

// Le panneau actif est rendu hors de RadixTabs.Content : son Presence lit
// getComputedStyle au montage, ce qui forçait le recalcul de style de tout
// le contenu (0,42 s pour le fil en CPU x4).
export function Tabs({
  items,
  value,
  onValueChange,
  className,
  layout = "start",
  scrollable = false,
}: TabsProps) {
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
          // Une rangée qui défile coupe ce qui déborde de sa boîte : le filet est
          // dessiné à l'intérieur et le soulignement de l'onglet actif se pose dessus.
          scrollable &&
            "scrollbar-none overflow-x-auto border-b-0 shadow-[inset_0_-1px_0_0_var(--border)] [&>*]:shrink-0 [&>*]:whitespace-nowrap",
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            id={triggerId(item.value)}
            aria-controls={item.value === value ? panelId(item.value) : undefined}
            className={cn(
              "relative rounded-control text-muted transition-colors duration-150 hover:text-text",
              !scrollable && "-mb-px",
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
