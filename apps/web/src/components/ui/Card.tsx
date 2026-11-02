import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface CardProps {
  as?: "div" | "li";
  /**
   * `framed` sépare un objet du reste de la page ; `plain` pose seulement un
   * fond `--surface`, pour un encart qui n'a rien à séparer (DESIGN.md,
   * "Cadres").
   */
  variant?: "framed" | "plain";
  padding?: "default" | "compact";
  className?: string;
  children: ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  default: "p-4",
  compact: "p-3",
};

const VARIANT_CLASSES: Record<NonNullable<CardProps["variant"]>, string> = {
  framed: "border border-border",
  plain: "bg-surface",
};

export function Card({
  as = "div",
  variant = "framed",
  padding = "default",
  className,
  children,
}: CardProps) {
  const Tag = as;
  return (
    <Tag className={cn("rounded-card", VARIANT_CLASSES[variant], PADDING_CLASSES[padding], className)}>
      {children}
    </Tag>
  );
}
