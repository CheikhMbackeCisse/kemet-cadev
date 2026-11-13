import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn.js";

/** "inverse" et "inverse-ghost" : sur le fond de marque du parcours d'arrivée, toujours sombre. */
export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "inverse" | "inverse-ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action-strong text-on-action-strong hover:bg-action-strong-hover",
  secondary: "bg-transparent text-text border border-border-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-2 hover:bg-surface-2",
  danger: "bg-danger text-danger-on hover:brightness-95",
  inverse: "bg-auth-text font-semibold text-[var(--auth-bg-to)] hover:bg-auth-button-hover",
  "inverse-ghost": "bg-transparent text-auth-text hover:bg-white/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-control md:h-control items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "max-md:h-control-mobile",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
