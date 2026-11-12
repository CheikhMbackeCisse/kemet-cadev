import {
  AppWindow,
  Braces,
  Briefcase,
  Cloud,
  CodeXml,
  Database,
  Flag,
  Gamepad2,
  Lock,
  MessagesSquare,
  Rocket,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { TECH_LOGOS, type TechLogoName } from "./techLogos.js";
import { techLogoFor } from "../../lib/skills/techLogo.js";
import { cn } from "../../lib/cn.js";

// Thèmes sans technologie unique : une icône Lucide, toujours un objet
// concret (jamais de robot, d'étincelles ni de bouclier coché). Le premier
// motif trouvé dans le nom l'emporte : CADEV avant les compétitions, le
// backend avant le cloud.
const THEME_ICONS: [RegExp, LucideIcon][] = [
  [/d[ée]but|[ée]tudi|apprend|lyc[ée]e/i, Sprout],
  [/cadev/i, Flag],
  [/hackathon|concours|comp[ée]tition|d[ée]fi/i, Trophy],
  [/carri[èe]re|emploi|freelance|recrut|stage/i, Briefcase],
  [/intelligence artificielle|\bia\b|\bai\b|data|donn[ée]es|machine learning/i, Database],
  [/backend|\bapi\b/i, Braces],
  [/devops|cloud|infra/i, Cloud],
  [/s[ée]curit[ée]|cyber/i, Lock],
  [/\bjeux?\b|game|gaming/i, Gamepad2],
  [/frontend|design|\bux\b|\bui\b|figma|web/i, AppWindow],
  [/startup|entrepr|produit/i, Rocket],
  [/code|d[ée]v|programm/i, CodeXml],
];

const TINT_COUNT = 6;

function tintOf(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % TINT_COUNT) + 1;
}

export function spaceTechLogo(name: string): TechLogoName | null {
  return techLogoFor([name]);
}

export function spaceThemeIcon(name: string): LucideIcon {
  return THEME_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? MessagesSquare;
}

const ICON_ORDER: LucideIcon[] = [...THEME_ICONS.map(([, icon]) => icon), MessagesSquare];

/**
 * Teinte de chaque espace d'une liste, d'après son icône et son rang : deux
 * espaces de même icône ont des teintes différentes (jusqu'à six), alors
 * qu'une teinte tirée de l'identifiant les faisait parfois se confondre.
 */
export function spaceTints(spaces: readonly { id: string; name: string }[]): Map<string, number> {
  const seen = new Map<LucideIcon, number>();
  const tints = new Map<string, number>();
  for (const space of spaces) {
    const icon = spaceThemeIcon(space.name);
    const rank = seen.get(icon) ?? 0;
    seen.set(icon, rank + 1);
    tints.set(space.id, ((ICON_ORDER.indexOf(icon) + rank) % TINT_COUNT) + 1);
  }
  return tints;
}

export interface SpaceIconProps {
  id: string;
  name: string;
  imageUrl?: string | null;
  /** Teinte donnée par `spaceTints` dans une liste ; sinon tirée de l'identifiant. */
  tint?: number;
  /** Taille de la pastille, en classes Tailwind (size-6, size-12...). */
  className?: string;
}

/**
 * Pastille d'un espace : son image, sinon le logo de sa technologie en
 * couleur sur fond blanc, sinon une icône blanche sur une teinte propre à
 * l'espace (--space-tint-N, contraste vérifié dans tokens.test.ts).
 */
export function SpaceIcon({
  id,
  name,
  imageUrl,
  tint,
  className,
}: SpaceIconProps) {
  const frame = cn("flex shrink-0 items-center justify-center overflow-hidden", className);
  if (imageUrl) {
    return (
      <span aria-hidden="true" className={frame}>
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </span>
    );
  }
  const tech = spaceTechLogo(name);
  if (tech) {
    const logo = TECH_LOGOS[tech];
    return (
      <span aria-hidden="true" className={cn(frame, "bg-white ring-1 ring-inset ring-border")}>
        <svg
          viewBox="0 0 24 24"
          className="size-[55%]"
          fill={logo.color === "#FFFFFF" ? "#000000" : logo.color}
        >
          <path d={logo.path} />
        </svg>
      </span>
    );
  }
  const Icon = spaceThemeIcon(name);
  return (
    <span
      aria-hidden="true"
      className={frame}
      style={{ backgroundColor: `var(--space-tint-${tint ?? tintOf(id)})` }}
    >
      <Icon className="size-[55%] text-white" />
    </span>
  );
}
