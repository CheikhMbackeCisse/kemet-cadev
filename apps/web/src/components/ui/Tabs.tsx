import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
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

export function Tabs({ items, value, onValueChange, className, layout = "start" }: TabsProps) {
  const centered = layout === "centered";
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
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="pt-4">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
