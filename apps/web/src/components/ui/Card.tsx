import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface CardProps {
  as?: "div" | "li";
  padding?: "default" | "compact";
  className?: string;
  children: ReactNode;
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  default: "p-4",
  compact: "p-3",
};

export function Card({ as = "div", padding = "default", className, children }: CardProps) {
  const Tag = as;
  return <Tag className={cn("rounded-card border border-border", PADDING_CLASSES[padding], className)}>{children}</Tag>;
}
