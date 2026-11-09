import { Sprout } from "lucide-react";
import { Badge } from "../ui/Badge.js";
import { fr } from "../../i18n/fr.js";

/** Étiquette "Débutant" d'un post ou d'un skill. */
export function BeginnerBadge({ className }: { className?: string }) {
  return (
    <Badge tone="neutral" className={className}>
      <Sprout className="size-3.5 text-success" aria-hidden="true" />
      {fr.beginners.label}
    </Badge>
  );
}
