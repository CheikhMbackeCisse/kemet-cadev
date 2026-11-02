import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export type BadgeTone = "neutral" | "accent" | "success" | "danger" | "primary";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-text-2",
  accent: "bg-accent-soft-2 text-text-2",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  primary: "bg-primary text-white",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
