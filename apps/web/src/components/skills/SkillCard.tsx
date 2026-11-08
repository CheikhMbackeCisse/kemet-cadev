import type { SkillSummary } from "@kemet/shared";
import { formatCount } from "../../lib/formatCount.js";
import { skillDomain } from "../../lib/skills/skillDomain.js";
import { fr } from "../../i18n/fr.js";
import { SkillBanner, SkillDomainIcon } from "./SkillBanner.js";
import { SkillRating } from "./SkillRating.js";

/**
 * Carte d'un skill, sur le modèle des Quêtes de Discord : bannière, icône,
 * titre, auteur, note, utilisations et "Voir". Toute la carte mène au skill.
 */
export function SkillCard({ skill }: { skill: SkillSummary }) {
  const domain = skillDomain(skill);
  return (
    <a
      href={`/skills/${skill.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-bg transition-colors duration-150 hover:border-border-strong"
    >
      <SkillBanner domain={domain} seed={skill.slug} className="h-20" />
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <SkillDomainIcon domain={domain} className="-mt-6" />
        <div className="flex flex-col gap-0.5">
          <span className="line-clamp-2 break-words text-base font-semibold text-text">{skill.name}</span>
          <span className="truncate text-xs text-subtle">{fr.skills.byAuthor(skill.authorDisplayName)}</span>
        </div>
        <p className="line-clamp-2 text-base text-text-2">{skill.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex min-w-0 flex-col gap-1">
            <SkillRating average={skill.averageStars} count={skill.ratingCount} />
            <span className="text-xs text-subtle tabular-nums">
              {fr.skills.usageCount(formatCount(skill.usageCount), skill.usageCount)}
            </span>
          </div>
          <span className="inline-flex h-control shrink-0 items-center rounded-control border border-border-strong px-3 text-base font-medium text-text group-hover:bg-surface-2 max-md:h-control-mobile">
            {fr.skills.view}
          </span>
        </div>
      </div>
    </a>
  );
}
