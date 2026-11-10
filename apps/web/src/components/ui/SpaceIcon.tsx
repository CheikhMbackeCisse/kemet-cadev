import {
  BrainCircuit,
  Briefcase,
  Code2,
  Gamepad2,
  GraduationCap,
  MessagesSquare,
  Palette,
  Rocket,
  Server,
  ShieldCheck,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { TECH_LOGOS, type TechLogoName } from "./techLogos.js";
import { techLogoFor } from "../../lib/skills/techLogo.js";
import { cn } from "../../lib/cn.js";

// Thèmes sans technologie unique : une icône Lucide. Le premier mot trouvé
// dans le nom l'emporte.
const THEME_ICONS: [RegExp, LucideIcon][] = [
  [/d[ée]but|[ée]tudi|apprend|lyc[ée]e/i, GraduationCap],
  [/carri[èe]re|emploi|freelance|recrut|stage/i, Briefcase],
  [/intelligence artificielle|\bia\b|\bai\b|data|donn[ée]es|machine learning/i, BrainCircuit],
  [/design|ux|ui\b|figma/i, Palette],
  [/s[ée]curit[ée]|cyber/i, ShieldCheck],
  [/devops|cloud|backend|api|infra/i, Server],
  [/jeu|game|gaming/i, Gamepad2],
  [/startup|entrepr|produit/i, Rocket],
  [/cadev|comp[ée]tition|hackathon|d[ée]fi/i, Trophy],
  [/code|dev|programm/i, Code2],
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

export interface SpaceIconProps {
  id: string;
  name: string;
  imageUrl?: string | null;
  /** Taille de la pastille, en classes Tailwind (size-6, size-12...). */
  className?: string;
  /** Taille du logo ou de l'icône à l'intérieur. */
  glyphClassName?: string;
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
  className,
  glyphClassName = "size-4",
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
          className={glyphClassName}
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
      style={{ backgroundColor: `var(--space-tint-${tintOf(id)})` }}
    >
      <Icon className={cn("text-white", glyphClassName)} />
    </span>
  );
}
