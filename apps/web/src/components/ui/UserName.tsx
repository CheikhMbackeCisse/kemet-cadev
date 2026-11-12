import { LevelBadge, type Level } from "./LevelBadge.js";
import { OrganizationLabel } from "./OrganizationLabel.js";
import { ProfileLink } from "./ProfileLink.js";
import { cn } from "../../lib/cn.js";

export interface UserNameProps {
  name: string;
  /** Absent pour une organisation et pour Kocc : ni insigne, ni niveau. */
  level?: Level | null;
  /** Organisation : l'étiquette "Organisation" à la place de l'insigne. */
  organization?: boolean;
  /**
   * Le nom devient un lien vers le profil, l'insigne un lien vers /niveaux.
   * Sans handle, tout reste du texte : le nom est déjà dans un lien plus grand.
   */
  handle?: string;
  className?: string;
}

/** Jamais de drapeau ici : il est porté par l'avatar seul. */
export function UserName({ name, level, organization = false, handle, className }: UserNameProps) {
  const nameText = <span className="truncate font-medium text-text">{name}</span>;
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      {handle ? (
        <ProfileLink handle={handle} className="min-w-0 truncate">
          {nameText}
        </ProfileLink>
      ) : (
        nameText
      )}
      {organization ? (
        <OrganizationLabel />
      ) : (
        level && <LevelBadge level={level} link={Boolean(handle)} />
      )}
    </span>
  );
}
