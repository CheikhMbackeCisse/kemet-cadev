import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-control max-md:h-control-mobile w-full rounded-control border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-subtle",
          "focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
