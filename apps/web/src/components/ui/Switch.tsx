import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "../../lib/cn.js";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <RadixSwitch.Root
      {...props}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border border-border-strong bg-surface-2 transition-colors duration-150",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Élargit la zone tactile à 44px sur mobile sans agrandir la piste visible.
        "max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']",
        className,
      )}
    >
      <RadixSwitch.Thumb className="block size-4 translate-x-1 rounded-full bg-white transition-transform duration-150 data-[state=checked]:translate-x-5" />
    </RadixSwitch.Root>
  );
}
