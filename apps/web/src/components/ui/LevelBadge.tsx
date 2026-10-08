import { cn } from "../../lib/cn.js";

export type Level = "apprenti" | "artisan" | "scribe" | "architecte" | "legende";

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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        level === "legende" ? "bg-primary text-white" : "bg-surface-2 text-text-2",
        className,
      )}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}
