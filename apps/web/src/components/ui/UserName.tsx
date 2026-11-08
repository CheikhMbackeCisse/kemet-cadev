import { LevelBadge, type Level } from "./LevelBadge.js";
import { ProfileLink } from "./ProfileLink.js";
import { cn } from "../../lib/cn.js";

export interface UserNameProps {
  name: string;
  level?: Level;
  /**
   * Le nom devient un lien vers le profil, l'insigne un lien vers /niveaux.
   * Sans handle, tout reste du texte : le nom est déjà dans un lien plus grand.
   */
  handle?: string;
  className?: string;
}

/** Jamais de drapeau ici : il est porté par l'avatar seul. */
export function UserName({ name, level, handle, className }: UserNameProps) {
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
      {level && <LevelBadge level={level} link={Boolean(handle)} />}
    </span>
  );
}
