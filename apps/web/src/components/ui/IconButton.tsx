import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  active?: boolean;
  loading?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { active = false, loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      // Une icône seule se nomme au survol : son nom n'est pas réservé aux lecteurs d'écran.
      title={props["aria-label"]}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex size-control md:size-control max-md:size-control-mobile items-center justify-center rounded-control text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
        active && "bg-accent-soft text-primary hover:bg-accent-soft",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : children}
    </button>
  );
});
