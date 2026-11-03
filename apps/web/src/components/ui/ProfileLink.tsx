import type { ReactNode } from "react";
import { isDeletedAccountHandle, type Level } from "@kemet/shared";
import { cn } from "../../lib/cn.js";

export interface ProfileLinkProps {
  handle: string;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}

/**
 * Lien vers le profil d'un auteur. Un compte supprimé n'a plus de page : son
 * nom reste affiché ("Compte supprimé"), sans lien (ADR 0023).
 */
export function ProfileLink({ handle, className, children, ...props }: ProfileLinkProps) {
  if (isDeletedAccountHandle(handle)) return <span className={className}>{children}</span>;
  return (
    <a href={`/u/${handle}`} className={cn(className, "hover:underline")} {...props}>
      {children}
    </a>
  );
}

/** Pas de badge de niveau pour un compte supprimé. */
export function authorLevel(handle: string, level: Level): Level | undefined {
  return isDeletedAccountHandle(handle) ? undefined : level;
}
