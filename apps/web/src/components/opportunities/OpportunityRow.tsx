import { Briefcase, GraduationCap, Handshake, type LucideIcon } from "lucide-react";
import { useId } from "react";
import type { OpportunityKind, OpportunitySummary } from "@kemet/shared";
import { cn } from "../../lib/cn.js";
import {
  deadlineLabel,
  kindLabel,
  locationLabel,
  moneyLabel,
} from "../../lib/opportunities/format.js";
import { heightKeyProps } from "../../lib/navigation/rememberedHeights.js";
import { fr } from "../../i18n/fr.js";
import { Avatar } from "../ui/Avatar.js";
import { Badge } from "../ui/Badge.js";
import { Skeleton } from "../ui/Skeleton.js";

export const OPPORTUNITY_KIND_ICONS: Record<OpportunityKind, LucideIcon> = {
  job: Briefcase,
  internship: GraduationCap,
  mission: Handshake,
};

export const OPPORTUNITY_ROW_ESTIMATED_HEIGHT_PX = 150;

export interface OpportunityRowProps {
  opportunity: OpportunitySummary;
  /** "card" glissée dans le fil "Pour toi", "row" dans l'onglet Opportunités. */
  variant?: "card" | "row";
  heightKey?: string;
}

/** Une offre en une ligne de liste : type, titre, organisation et lieu, puis l'argent et la date limite. */
export function OpportunityRow({ opportunity, variant = "row", heightKey }: OpportunityRowProps) {
  const titleId = useId();
  const Icon = OPPORTUNITY_KIND_ICONS[opportunity.kind];
  const money = moneyLabel(opportunity);
  const deadline = deadlineLabel(opportunity);
  const href = `/opportunites/${opportunity.slug}`;
  const isOrganization = opportunity.authorKind === "organization";

  return (
    <li {...heightKeyProps(heightKey, OPPORTUNITY_ROW_ESTIMATED_HEIGHT_PX)} className="py-4">
      <article
        aria-labelledby={titleId}
        className={cn(
          "relative flex gap-3",
          variant === "card" && "rounded-card border border-border bg-bg p-4",
        )}
      >
        {/* Seule l'icône s'efface : le texte d'une offre clôturée garde un contraste de 4,5:1. */}
        {isOrganization ? (
          // Offre d'une organisation : son logo à la place de l'icône du type.
          <Avatar
            name={opportunity.authorDisplayName}
            src={opportunity.authorAvatarUrl ?? undefined}
            size={40}
            square
            className={cn("border border-border", opportunity.closed && "opacity-70")}
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-card bg-surface-2 text-text-2",
              opportunity.closed && "opacity-70",
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{kindLabel(opportunity)}</Badge>
            {opportunity.closed && <Badge tone="danger">{fr.opportunities.closed}</Badge>}
          </div>
          <a
            id={titleId}
            href={href}
            className={cn(
              "break-words text-base font-semibold after:absolute after:inset-0 hover:underline",
              opportunity.closed ? "text-subtle" : "text-text",
            )}
          >
            {opportunity.title}
          </a>
          <p className={cn("text-sm", opportunity.closed ? "text-subtle" : "text-text-2")}>
            {isOrganization ? opportunity.authorDisplayName : opportunity.organization}
            <span aria-hidden="true"> · </span>
            {locationLabel(opportunity)}
          </p>
          {(money || deadline) && (
            <p
              className={cn(
                "flex flex-wrap gap-x-3 gap-y-0.5 text-sm",
                opportunity.closed ? "text-subtle" : "text-muted",
              )}
            >
              {money && <span>{money}</span>}
              {deadline && <span>{deadline}</span>}
            </p>
          )}
        </div>
      </article>
    </li>
  );
}

export function OpportunityRowSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <Skeleton className="size-10 shrink-0 rounded-card" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
