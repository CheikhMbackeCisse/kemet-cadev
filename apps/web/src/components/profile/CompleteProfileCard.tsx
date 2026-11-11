import { BookOpen, FileText, FolderGit2, Link2, Wrench, type LucideIcon } from "lucide-react";
import { fr } from "../../i18n/fr.js";

export interface ProfileGaps {
  cv: boolean;
  links: boolean;
  work: boolean;
  project: boolean;
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
    key: "project",
    icon: FolderGit2,
    label: fr.profile.missingProject,
    action: fr.profile.publish,
    href: "/projets/nouveau",
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
 * par élément, plutôt qu'un bloc vide par section.
 */
export function CompleteProfileCard({ gaps }: { gaps: ProfileGaps }) {
  const rows = ROWS.filter((row) => gaps[row.key]);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="complete-profile-title" className="rounded-card border border-border">
      <h2 id="complete-profile-title" className="px-3 pb-1 pt-3 text-md font-semibold text-text">
        {fr.profile.completeTitle}
      </h2>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex min-h-control-mobile items-center gap-3 px-3 py-1.5">
            <row.icon className="size-5 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm text-text">{row.label}</span>
            <a
              href={row.href}
              aria-label={`${row.action} : ${row.label}`}
              className="inline-flex h-8 shrink-0 items-center rounded-control border border-border-strong px-3 text-sm font-medium text-text hover:bg-surface-2 max-md:h-control-mobile"
            >
              {row.action}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
