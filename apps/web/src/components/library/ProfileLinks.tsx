import { Briefcase, GitBranch, GitMerge, Globe, UserRound, type LucideIcon } from "lucide-react";
import { isValidProfileLink, type Profile, type ProfileLinkKind } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

const LINK_LABELS: Record<ProfileLinkKind, string> = {
  github: fr.library.linkGithub,
  gitlab: fr.library.linkGitlab,
  linkedin: fr.library.linkLinkedin,
  portfolio: fr.library.linkPortfolio,
  website: fr.library.linkWebsite,
};

// Icônes Lucide, jamais les logos des services : DESIGN.md réserve les
// logos de marque aux boutons de connexion.
const LINK_ICONS: Record<ProfileLinkKind, LucideIcon> = {
  github: GitBranch,
  gitlab: GitMerge,
  linkedin: UserRound,
  portfolio: Briefcase,
  website: Globe,
};

export function profileLinks(profile: Profile): { kind: ProfileLinkKind; url: string }[] {
  const entries: [ProfileLinkKind, string | null][] = [
    ["github", profile.githubUrl],
    ["gitlab", profile.gitlabUrl],
    ["linkedin", profile.linkedinUrl],
    ["portfolio", profile.portfolioUrl],
    ["website", profile.websiteUrl],
  ];
  // Un lien enregistré avant la règle actuelle peut ne plus la respecter : il n'est pas affiché.
  return entries.flatMap(([kind, url]) => (url && isValidProfileLink(kind, url) ? [{ kind, url }] : []));
}

function displayUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
}

function LinkIcon({ kind }: { kind: ProfileLinkKind }) {
  const Icon = LINK_ICONS[kind];
  return <Icon className="size-5 shrink-0 text-subtle" aria-hidden="true" />;
}

/** Liens principaux d'un profil, chacun avec l'icône de son service. */
export function ProfileLinks({ links }: { links: { kind: ProfileLinkKind; url: string }[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {links.map((link) => (
        <li key={link.kind}>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="-mx-2 flex min-h-control-mobile items-center gap-3 rounded-control px-2 py-2 text-text hover:bg-surface-2 md:min-h-control"
          >
            <LinkIcon kind={link.kind} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{LINK_LABELS[link.kind]}</span>
              <span className="truncate text-xs text-subtle">{displayUrl(link.url)}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
