import {
  BrainCircuit,
  Code2,
  Database,
  LayoutTemplate,
  Server,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { SkillDomain } from "../../lib/skills/skillDomain.js";
import { cn } from "../../lib/cn.js";

const DOMAIN_ICONS: Record<SkillDomain, LucideIcon> = {
  payments: Wallet,
  ai: BrainCircuit,
  data: Database,
  infra: Wrench,
  front: LayoutTemplate,
  back: Server,
  other: Code2,
};

/** Icône du domaine d'un skill. */
export function SkillDomainIcon({
  domain,
  className,
}: {
  domain: SkillDomain;
  className?: string;
}) {
  const Icon = DOMAIN_ICONS[domain];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 items-center justify-center rounded-card border-4 border-bg bg-surface-2 text-text",
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
