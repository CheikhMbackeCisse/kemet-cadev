import type { SkillSummary } from "@kemet/shared";
import { formatCount } from "../../lib/formatCount.js";
import { skillDomain } from "../../lib/skills/skillDomain.js";
import { fr } from "../../i18n/fr.js";
import { Avatar } from "../ui/Avatar.js";
import { SkillCodeCover } from "./SkillCodeCover.js";

function statsLine(skill: SkillSummary): string {
  const parts: string[] = [];
  if (skill.averageStars !== null && skill.ratingCount > 0) {
    parts.push(fr.skills.averageValue(skill.averageStars));
    parts.push(fr.skills.reviewCountShort(formatCount(skill.ratingCount)));
  }
  parts.push(fr.skills.usageCountShort(formatCount(skill.usageCount), skill.usageCount));
  return parts.join(" · ");
}

/**
 * Carte d'un skill, sur le modèle de WorkCard : couverture de code, domaine,
 * nom, auteur, description, chiffres. Le nom porte le lien étiré sur la carte.
 */
export function SkillCard({ skill }: { skill: SkillSummary }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-bg transition-colors duration-150 hover:border-border-strong has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-primary">
      <SkillCodeCover skill={skill} className="border-b border-border" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs text-subtle">{fr.skills.domainNames[skillDomain(skill)]}</span>
        <a
          href={`/skills/${skill.slug}`}
          className="line-clamp-2 break-words text-base font-semibold text-text after:absolute after:inset-0 after:content-[''] hover:underline"
        >
          {skill.name}
        </a>
        <span className="flex min-w-0 items-center gap-2 text-xs text-text-2">
          <Avatar
            name={skill.authorDisplayName}
            src={skill.authorAvatarUrl ?? undefined}
            size={24}
          />
          <span className="truncate">{fr.skills.byAuthor(skill.authorDisplayName)}</span>
        </span>
        <p className="line-clamp-2 text-base text-text-2">{skill.description}</p>
        <span className="mt-auto pt-1 text-xs text-subtle tabular-nums">{statsLine(skill)}</span>
      </div>
    </div>
  );
}
