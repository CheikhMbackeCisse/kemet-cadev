import { Flag } from "./Flag.js";
import { LevelBadge, type Level } from "./LevelBadge.js";
import { cn } from "../../lib/cn.js";

export interface UserNameProps {
  name: string;
  countryCode?: string;
  level?: Level;
  className?: string;
}

export function UserName({ name, countryCode, level, className }: UserNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-medium text-text">{name}</span>
      {countryCode && <Flag countryCode={countryCode} />}
      {level && <LevelBadge level={level} />}
    </span>
  );
}
