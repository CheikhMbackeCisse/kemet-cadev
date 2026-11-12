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
// concret (jamais de robot, d'étincelles ni de bouclier coché), et sa teinte
// (--space-tint-N) : une teinte par icône, la même partout. Le premier motif
// trouvé dans le nom l'emporte : CADEV avant les compétitions, le backend
// avant le cloud.
const THEME_ICONS: [RegExp, LucideIcon, number][] = [
  [/d[ée]but|[ée]tudi|apprend|lyc[ée]e/i, Sprout, 2],
  [/cadev/i, Flag, 7],
  [/hackathon|concours|comp[ée]tition|d[ée]fi/i, Trophy, 6],
  [/carri[èe]re|emploi|freelance|recrut|stage/i, Briefcase, 9],
  [/intelligence artificielle|\bia\b|\bai\b|data|donn[ée]es|machine learning/i, Database, 3],
  [/backend|\bapi\b/i, Braces, 8],
  [/devops|cloud|infra/i, Cloud, 1],
  [/s[ée]curit[ée]|cyber/i, Lock, 10],
  [/\bjeux?\b|game|gaming/i, Gamepad2, 4],
  [/frontend|design|\bux\b|\bui\b|figma|web/i, AppWindow, 5],
  [/startup|entrepr|produit/i, Rocket, 11],
  [/code|d[ée]v|programm/i, CodeXml, 12],
];

const TINT_COUNT = 12;

function tintOf(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % TINT_COUNT) + 1;
}

export function spaceTechLogo(name: string): TechLogoName | null {
  return techLogoFor([name]);
}

function themeOf(name: string): [RegExp, LucideIcon, number] | undefined {
  return THEME_ICONS.find(([pattern]) => pattern.test(name));
}

export function spaceThemeIcon(name: string): LucideIcon {
  return themeOf(name)?.[1] ?? MessagesSquare;
}

/**
 * Teinte de chaque espace d'une liste. Une icône de thème a toujours sa
 * teinte ; les espaces sans thème (bulles) prennent les douze teintes tour à
 * tour, pour ne pas se confondre entre eux.
 */
export function spaceTints(spaces: readonly { id: string; name: string }[]): Map<string, number> {
  const tints = new Map<string, number>();
  let generic = 0;
  for (const space of spaces) {
    const theme = themeOf(space.name);
    if (theme) tints.set(space.id, theme[2]);
    else {
      tints.set(space.id, (generic % TINT_COUNT) + 1);
      generic += 1;
    }
  }
  return tints;
}

export interface SpaceIconProps {
  id: string;
  name: string;
  imageUrl?: string | null;
  /** Espace sans thème : teinte donnée par `spaceTints` dans une liste, sinon tirée de l'identifiant. */
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
      style={{ backgroundColor: `var(--space-tint-${themeOf(name)?.[2] ?? tint ?? tintOf(id)})` }}
    >
      <Icon className="size-[55%] text-white" />
    </span>
  );
}
