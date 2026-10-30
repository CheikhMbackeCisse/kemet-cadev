import { LevelBadge, type Level } from "./LevelBadge.js";
import { cn } from "../../lib/cn.js";

export interface UserNameProps {
  name: string;
  level?: Level;
  className?: string;
}

/** Jamais de drapeau ici : il est porté par l'avatar seul. */
export function UserName({ name, level, className }: UserNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-medium text-text">{name}</span>
      {level && <LevelBadge level={level} />}
    </span>
  );
}
