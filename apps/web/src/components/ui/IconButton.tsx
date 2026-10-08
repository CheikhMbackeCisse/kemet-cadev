import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { active = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex size-control md:size-control max-md:size-control-mobile items-center justify-center rounded-control text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text",
        active && "bg-accent-soft text-primary hover:bg-accent-soft",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
