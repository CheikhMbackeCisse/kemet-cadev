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
        // Discret à côté d'un nom : contour seul, pour ne pas se confondre
        // avec les pastilles pleines de format ou de statut. Légende garde
        // la couleur de marque.
        level === "legende" ? "bg-primary text-white" : "border border-border text-subtle",
        className,
      )}
    >
      <span className="sr-only">Niveau </span>
      {LEVEL_LABELS[level]}
    </span>
  );
}
