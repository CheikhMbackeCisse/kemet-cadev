import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-control border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-subtle",
          "focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
