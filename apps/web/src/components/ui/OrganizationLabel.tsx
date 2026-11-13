import { Building2 } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { fr } from "../../i18n/fr.js";

/**
 * Étiquette à côté du nom d'une organisation. Toujours le mot écrit, en
 * couleurs neutres : seule, une icône colorée passerait pour une coche de
 * vérification, qui n'existe pas dans Kemet.
 */
export function OrganizationLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-control bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-text-2",
        className,
      )}
    >
      <Building2 className="size-3.5" aria-hidden="true" />
      {fr.organizations.label}
    </span>
  );
}
