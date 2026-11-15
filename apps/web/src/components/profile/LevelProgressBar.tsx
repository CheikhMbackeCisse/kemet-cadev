import { LEVEL_LABELS } from "../ui/LevelBadge.js";
import { LEVEL_FILL_CLASSES, LEVEL_TEXT_CLASSES } from "../ui/levelColors.js";
import { cn } from "../../lib/cn.js";
import { levelProgress } from "../../lib/levels/progress.js";
import { fr } from "../../i18n/fr.js";
import { LOCALE } from "../../i18n/language.js";

// Ses propres points au point près : "2,6k" ne laisse pas suivre sa progression.
const exactNumber = new Intl.NumberFormat(LOCALE);

/** Fine barre vers le niveau suivant, à la couleur de l'insigne ; au plus haut niveau, son nom seul. */
export function LevelProgressBar({ points }: { points: number }) {
  const { level, next } = levelProgress(points);
  if (!next) {
    return (
      <p className={cn("text-sm font-medium", LEVEL_TEXT_CLASSES[level])}>{LEVEL_LABELS[level]}</p>
    );
  }
  const nextLabel = LEVEL_LABELS[next.level];
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={fr.levels.progressLabel(nextLabel)}
        aria-valuemin={next.fromPoints}
        aria-valuemax={next.minPoints}
        aria-valuenow={points}
        className="h-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn("h-full rounded-full", LEVEL_FILL_CLASSES[level])}
          style={{ width: `${Math.max(2, Math.round(next.ratio * 100))}%` }}
        />
      </div>
      <p className="text-sm text-text-2">
        {fr.profile.levelProgress(
          exactNumber.format(points),
          exactNumber.format(next.remaining),
          nextLabel,
        )}
      </p>
    </div>
  );
}
