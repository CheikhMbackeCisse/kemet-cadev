import { Star } from "lucide-react";
import { formatCount } from "../../lib/formatCount.js";
import { fr } from "../../i18n/fr.js";

/** Moyenne et nombre d'avis ; "Pas encore noté" seulement sans aucune note. */
export function SkillRating({ average, count }: { average: number | null; count: number }) {
  if (count === 0 || average === null) {
    return <span className="text-xs text-subtle">{fr.skills.notRatedYet}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-2">
      <Star className="size-4 fill-current text-rating-star" aria-hidden="true" />
      <span className="sr-only">{fr.skills.ratingLabel(average, count)}</span>
      <span aria-hidden="true" className="font-medium text-text tabular-nums">
        {fr.skills.averageValue(average)}
      </span>
      <span aria-hidden="true" className="tabular-nums">
        {fr.skills.reviewCount(formatCount(count))}
      </span>
    </span>
  );
}
