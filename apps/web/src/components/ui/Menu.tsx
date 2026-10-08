import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface MenuItem {
  value: string;
  label: string;
  danger?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  onSelect: (value: string) => void;
  selectedValue?: string;
  align?: "start" | "center" | "end";
}

export function Menu({ trigger, items, onSelect, selectedValue, align = "end" }: MenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-40 overflow-hidden rounded-panel border border-border bg-surface p-1 shadow-floating"
        >
          {items.map((item) => (
            <RadixMenu.Item
              key={item.value}
              onSelect={() => onSelect(item.value)}
              className={cn(
                "flex h-9 cursor-pointer select-none items-center justify-between rounded-control px-2 text-sm outline-none",
                "data-[highlighted]:bg-surface-2",
                item.danger ? "text-danger" : "text-text",
              )}
            >
              {item.label}
              {selectedValue === item.value && <Check className="size-4" aria-hidden="true" />}
            </RadixMenu.Item>
          ))}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
