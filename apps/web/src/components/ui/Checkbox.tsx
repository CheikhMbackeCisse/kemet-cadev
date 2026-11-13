import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <RadixCheckbox.Root
      {...props}
      // 20 px de côté : le rayon des contrôles (8 px) en ferait presque un
      // rond ; 6 px est le minimum de l'échelle (DESIGN.md).
      className={cn(
        "relative flex size-5 items-center justify-center rounded-[6px] border border-border-strong bg-bg",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Élargit la zone tactile à 44px sur mobile sans agrandir le carré visible.
        "max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']",
        className,
      )}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3.5 text-white" aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
