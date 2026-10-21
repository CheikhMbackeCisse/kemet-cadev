import { LevelBadge, type Level } from "./LevelBadge.js";
import { cn } from "../../lib/cn.js";

export interface UserNameProps {
  name: string;
  level?: Level;
  className?: string;
}

/**
 * Le drapeau du pays n'est jamais rendu ici : il est porté par l'avatar
 * (`Avatar`, prop `countryCode`). Les afficher aux deux endroits doublait le
 * drapeau sur chaque post et chaque message.
 */
export function UserName({ name, level, className }: UserNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-medium text-text">{name}</span>
      {level && <LevelBadge level={level} />}
    </span>
  );
}
