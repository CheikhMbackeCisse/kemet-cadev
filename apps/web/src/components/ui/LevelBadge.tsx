import { Compass, Crown, Feather, Hammer, Sprout, type LucideIcon } from "lucide-react";
import type { Level } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

export type { Level } from "@kemet/shared";

export const LEVEL_LABELS: Record<Level, string> = {
  apprenti: "Apprenti",
  artisan: "Artisan",
  scribe: "Scribe",
  architecte: "Architecte",
  legende: "Légende",
};

const LEVEL_ICONS: Record<Level, LucideIcon> = {
  apprenti: Sprout,
  artisan: Hammer,
  scribe: Feather,
  architecte: Compass,
  legende: Crown,
};

// Classes écrites en entier : Tailwind ne voit pas une classe composée.
const LEVEL_COLORS: Record<Level, string> = {
  apprenti: "text-level-apprenti",
  artisan: "text-level-artisan",
  scribe: "text-level-scribe",
  architecte: "text-level-architecte",
  legende: "text-level-legende",
};

export interface LevelBadgeProps {
  level: Level;
  /** Nom du niveau écrit à côté de l'icône : sur le profil, pas à côté d'un nom dans une liste. */
  showLabel?: boolean;
  className?: string;
}

/** Icône de couleur propre au niveau, son nom au survol et pour les lecteurs d'écran. */
export function LevelBadge({ level, showLabel = false, className }: LevelBadgeProps) {
  const Icon = LEVEL_ICONS[level];
  const label = fr.levels.label(LEVEL_LABELS[level]);
  if (showLabel) {
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-medium", LEVEL_COLORS[level], className)}>
        <Icon className="size-4" aria-hidden="true" />
        <span className="sr-only">{fr.levels.prefix} </span>
        {LEVEL_LABELS[level]}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      title={LEVEL_LABELS[level]}
      className={cn("inline-flex shrink-0 items-center", LEVEL_COLORS[level], className)}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
