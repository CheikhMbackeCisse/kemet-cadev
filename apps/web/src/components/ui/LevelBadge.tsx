import type { Level } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";
import { LevelInsignia } from "./LevelInsignia.js";
import { LEVEL_TEXT_CLASSES } from "./levelColors.js";

export type { Level } from "@kemet/shared";

export const LEVEL_LABELS: Record<Level, string> = {
  apprenti: "Apprenti",
  artisan: "Artisan",
  scribe: "Scribe",
  architecte: "Architecte",
  legende: "Légende",
};

export const LEVELS_PATH = "/niveaux";

export interface LevelBadgeProps {
  level: Level;
  /** Nom du niveau écrit à côté de l'insigne : sur le profil, pas à côté d'un nom dans une liste. */
  showLabel?: boolean;
  /**
   * Lien vers /niveaux. Jamais à l'intérieur d'un autre lien (une carte
   * entière cliquable) : l'insigne y reste une simple image.
   */
  link?: boolean;
  /** Posé sur le fond de marque (carte en verre) : couleurs du thème sombre dans les deux thèmes. */
  tone?: "default" | "onDark";
  className?: string;
}

/** Insigne de couleur propre au niveau, son nom au survol et pour les lecteurs d'écran. */
export function LevelBadge({
  level,
  showLabel = false,
  link = false,
  tone = "default",
  className,
}: LevelBadgeProps) {
  const label = fr.levels.label(LEVEL_LABELS[level]);
  const classes = cn(
    "inline-flex shrink-0 items-center",
    tone === "onDark" && "level-on-dark",
    LEVEL_TEXT_CLASSES[level],
    className,
  );
  const content = showLabel ? (
    <>
      <LevelInsignia level={level} className="size-5" />
      <span className="text-xs font-medium">
        <span className="sr-only">{fr.levels.prefix} </span>
        {LEVEL_LABELS[level]}
      </span>
    </>
  ) : (
    <LevelInsignia level={level} className="size-4" />
  );

  if (link) {
    return (
      <a
        href={LEVELS_PATH}
        title={LEVEL_LABELS[level]}
        aria-label={showLabel ? undefined : fr.levels.linkLabel(LEVEL_LABELS[level])}
        className={cn(
          classes,
          "relative gap-1 rounded-control hover:opacity-80",
          // Zone de toucher agrandie sans déplacer le texte autour : 44 px
          // autour d'un insigne de 16 px sur mobile.
          "after:absolute after:-inset-2 after:content-[''] max-md:after:-inset-3.5",
        )}
      >
        {content}
      </a>
    );
  }
  if (showLabel) return <span className={cn(classes, "gap-1")}>{content}</span>;
  return (
    <span role="img" aria-label={label} title={LEVEL_LABELS[level]} className={classes}>
      {content}
    </span>
  );
}
