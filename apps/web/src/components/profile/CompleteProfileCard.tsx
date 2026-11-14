import { BookOpen, FileText, Link2, Wrench, type LucideIcon } from "lucide-react";
import { fr } from "../../i18n/fr.js";

export interface ProfileGaps {
  cv: boolean;
  links: boolean;
  work: boolean;
  skill: boolean;
}

interface GapRow {
  key: keyof ProfileGaps;
  icon: LucideIcon;
  label: string;
  action: string;
  href: string;
}

const ROWS: GapRow[] = [
  {
    key: "cv",
    icon: FileText,
    label: fr.profile.missingCv,
    action: fr.profile.add,
    href: "/parametres/profil#cv",
  },
  {
    key: "links",
    icon: Link2,
    label: fr.profile.missingLinks,
    action: fr.profile.add,
    href: "/parametres/profil",
  },
  {
    key: "work",
    icon: BookOpen,
    label: fr.profile.missingWork,
    action: fr.profile.publish,
    href: "/travaux/nouveau",
  },
  {
    key: "skill",
    icon: Wrench,
    label: fr.profile.missingSkill,
    action: fr.profile.create,
    href: "/skills/nouveau",
  },
];

/**
 * Sur son propre profil, une seule carte pour tout ce qui manque, une ligne
 * par élément, plutôt qu'un bloc vide par section. Pas de ligne pour un
 * projet : un projet cherche de l'aide, il ne complète pas un profil.
 */
export function CompleteProfileCard({ gaps }: { gaps: ProfileGaps }) {
  const rows = ROWS.filter((row) => gaps[row.key]);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="complete-profile-title" className="rounded-card border border-border">
      <h2 id="complete-profile-title" className="px-3 pt-2.5 text-md font-semibold text-text">
        {fr.profile.completeTitle}
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex h-11 items-center gap-3 px-3">
            <row.icon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm text-text">{row.label}</span>
            <a
              href={row.href}
              aria-label={`${row.action} : ${row.label}`}
              // 32 px à l'œil, 44 px sous le doigt : la zone d'appui déborde de la ligne.
              className="relative inline-flex h-8 shrink-0 items-center rounded-control border border-border-strong px-2.5 text-[13px] font-medium text-text after:absolute after:-inset-y-1.5 after:inset-x-0 hover:bg-surface-2"
            >
              {row.action}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
