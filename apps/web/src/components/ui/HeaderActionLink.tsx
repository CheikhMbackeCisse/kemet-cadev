import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface HeaderActionLinkProps {
  href: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

/**
 * Action principale d'une page, à droite de son titre (Publier, Créer…).
 * Taille d'un bouton ordinaire ; sur écran tactile, la zone de toucher
 * s'étend à 44 px sans grossir le bouton.
 */
export function HeaderActionLink({ href, icon: Icon, className, children }: HeaderActionLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "relative inline-flex h-control shrink-0 items-center justify-center gap-1.5 rounded-control bg-action-strong px-3 text-sm font-medium text-on-action-strong hover:bg-action-strong-hover",
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        className,
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </a>
  );
}
