import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        aria-label={aria["aria-label"]}
        className={cn(
          "flex h-control max-md:h-control-mobile w-full items-center justify-between gap-2 rounded-control border border-border-strong bg-bg px-3 text-sm text-text",
          "focus-visible:border-primary",
          "data-[placeholder]:text-subtle",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted" aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden rounded-panel border border-border bg-surface shadow-floating"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "relative flex h-9 cursor-pointer select-none items-center rounded-control px-8 text-sm text-text outline-none",
                  "data-[highlighted]:bg-surface-2",
                )}
              >
                <RadixSelect.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
