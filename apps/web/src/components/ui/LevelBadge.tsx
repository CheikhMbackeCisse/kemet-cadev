import type { Level } from "@kemet/shared";
import { cn } from "../../lib/cn.js";

export type { Level } from "@kemet/shared";

const LEVEL_LABELS: Record<Level, string> = {
  apprenti: "Apprenti",
  artisan: "Artisan",
  scribe: "Scribe",
  architecte: "Architecte",
  legende: "Légende",
};

export interface LevelBadgeProps {
  level: Level;
  className?: string;
}

export function LevelBadge({ level, className }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        level === "legende" ? "bg-primary text-white" : "bg-accent-soft-2 text-level-badge-text",
        className,
      )}
    >
      <span className="sr-only">Niveau </span>
      {LEVEL_LABELS[level]}
    </span>
  );
}
