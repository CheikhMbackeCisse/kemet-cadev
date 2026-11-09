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

// Classes écrites en entier pour que Tailwind les trouve.
const DOMAIN_GRADIENTS: Record<SkillDomain, string> = {
  payments: "bg-[linear-gradient(135deg,var(--skill-payments-from),var(--skill-payments-to))]",
  ai: "bg-[linear-gradient(135deg,var(--skill-ai-from),var(--skill-ai-to))]",
  data: "bg-[linear-gradient(135deg,var(--skill-data-from),var(--skill-data-to))]",
  infra: "bg-[linear-gradient(135deg,var(--skill-infra-from),var(--skill-infra-to))]",
  front: "bg-[linear-gradient(135deg,var(--skill-front-from),var(--skill-front-to))]",
  back: "bg-[linear-gradient(135deg,var(--skill-back-from),var(--skill-back-to))]",
  other: "bg-[linear-gradient(135deg,var(--skill-other-from),var(--skill-other-to))]",
};

const CODE_MOTIF = ["{ }", "=>", "</>", "[ ]", "fn()", "&&", "::", "#!"];

export interface SkillBannerProps {
  domain: SkillDomain;
  /** Fait varier le motif d'un skill à l'autre. */
  seed: string;
  className?: string;
}

function hash(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

/** Bannière décorative, sans image externe : dégradé du domaine et motif de code. */
export function SkillBanner({ domain, seed, className }: SkillBannerProps) {
  const offset = hash(seed);
  const glyphs = Array.from(
    { length: 6 },
    (_, index) => CODE_MOTIF[(offset + index * 3) % CODE_MOTIF.length]!,
  );
  return (
    <div
      aria-hidden="true"
      className={cn("relative overflow-hidden", DOMAIN_GRADIENTS[domain], className)}
    >
      <div className="absolute inset-0 grid grid-cols-3 place-items-center font-mono text-base font-semibold text-white/20">
        {glyphs.map((glyph, index) => (
          <span
            key={index}
            className={index % 2 === offset % 2 ? "translate-y-2" : "-translate-y-2"}
          >
            {glyph}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Icône du domaine, posée à cheval sur la bannière. */
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
