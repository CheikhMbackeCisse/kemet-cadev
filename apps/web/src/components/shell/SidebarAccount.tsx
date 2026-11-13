import { LogIn } from "lucide-react";
import { useSession } from "../../session/SessionProvider.js";
import { cn } from "../../lib/cn.js";
import { Avatar } from "../ui/Avatar.js";
import { Tooltip } from "../ui/Tooltip.js";
import { fr } from "../../i18n/fr.js";

export interface SidebarAccountProps {
  /** Barre large : photo, nom et @ ; sinon la photo seule. */
  expanded: boolean;
  active: boolean;
}

/**
 * Pied de la barre latérale sur bureau : le compte mène tout droit au
 * profil. Se déconnecter vit dans Paramètres, Enregistrés et Modération
 * dans la barre elle-même. Sous lg, l'onglet "Moi" joue ce rôle.
 */
export function SidebarAccount({ expanded, active }: SidebarAccountProps) {
  const { status, profile } = useSession();

  if (status === "loading") return null;

  const rowClass = cn(
    "flex items-center rounded-full text-text hover:bg-surface-2",
    expanded ? "w-full gap-3 px-2 py-1" : "size-10 justify-center",
    active && "bg-action-strong text-on-action-strong hover:bg-action-strong",
  );

  if (status !== "ready" || !profile) {
    const link = (
      <a
        href="/connexion"
        aria-label={expanded ? undefined : fr.auth.signInCta}
        className={rowClass}
      >
        <LogIn className="size-[22px] text-link" aria-hidden="true" />
        {expanded && <span className="text-md font-medium text-link">{fr.auth.signInCta}</span>}
      </a>
    );
    return expanded ? (
      link
    ) : (
      <Tooltip label={fr.auth.signInCta} side="right">
        {link}
      </Tooltip>
    );
  }

  const link = (
    <a
      href={`/u/${profile.handle}`}
      aria-label={fr.auth.accountLinkLabel(profile.displayName, profile.handle)}
      aria-current={active ? "page" : undefined}
      className={rowClass}
    >
      <Avatar name={profile.displayName} src={profile.avatarUrl ?? undefined} size={32} />
      {expanded && (
        <span className="flex min-w-0 flex-col" aria-hidden="true">
          <span className="truncate text-base font-semibold">{profile.displayName}</span>
          <span className={cn("truncate text-base", active ? "opacity-80" : "text-muted")}>
            @{profile.handle}
          </span>
        </span>
      )}
    </a>
  );
  return expanded ? (
    link
  ) : (
    <Tooltip label={`${profile.displayName} · @${profile.handle}`} side="right">
      {link}
    </Tooltip>
  );
}
