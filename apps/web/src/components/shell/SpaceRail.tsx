import { Plus } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { IconButton } from "../ui/IconButton.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";
import { Tooltip } from "../ui/Tooltip.js";
import { RAIL_NAV, type RailNavItem } from "./railNav.js";
import type { SpaceItem } from "./types.js";

export interface SpaceRailProps {
  /** Absent sur les pages hors salons : le rail ne porte alors que la navigation. */
  spaces?: SpaceItem[];
  activeSpaceId?: string;
  onSelect?: (id: string) => void;
  /** Section ouverte, pour marquer l'icone de navigation correspondante. */
  activeSection?: string;
  /** Absent pour un visiteur ou un compte suspendu : le bouton n'est pas rendu. */
  onCreateSpace?: () => void;
}

/** Barre verticale indiquant l'element actif, au bord gauche du rail. */
function ActiveMarker({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
        active ? "h-5" : "h-0 group-hover:h-2",
      )}
    />
  );
}

function NavLink({ item, active }: { item: RailNavItem; active: boolean }) {
  return (
    <li className="group relative flex w-full justify-center">
      <ActiveMarker active={active} />
      <Tooltip label={item.label} side="right">
        <a
          href={item.href}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex size-control items-center justify-center rounded-control hover:bg-accent-soft",
            active ? "bg-accent-soft text-primary" : "text-text-2 hover:text-text",
          )}
        >
          <item.icon className="size-5" aria-hidden="true" />
        </a>
      </Tooltip>
    </li>
  );
}

/**
 * Initiales du nom, faute d'image pour l'espace. Les mots de liaison et la
 * ponctuation sont ignores : "Carriere & Freelance Tech" donne CF, pas C&.
 */
const MONOGRAM_SKIP = new Set(["de", "du", "des", "la", "le", "les", "et", "d", "l"]);

function monogramOf(name: string): string {
  const words = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !MONOGRAM_SKIP.has(word.toLowerCase()));
  const initials = words.slice(0, 2).map((word) => word[0]!);
  return (initials.join("") || "?").toUpperCase();
}

function SpaceButton({
  space,
  active,
  onSelect,
}: {
  space: SpaceItem;
  active: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <li className="group relative flex w-full justify-center">
      <ActiveMarker active={active} />
      <Tooltip label={space.name} side="right">
        <button
          type="button"
          aria-label={space.name}
          aria-current={active ? "true" : undefined}
          onClick={() => onSelect?.(space.id)}
          className={cn(
            "inline-flex size-control items-center justify-center overflow-hidden rounded-control",
            active ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-border-strong",
          )}
        >
          {space.imageUrl ? (
            <img src={space.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center bg-accent-soft text-xs font-semibold text-primary">
              {monogramOf(space.name)}
            </span>
          )}
        </button>
      </Tooltip>
    </li>
  );
}

export function SpaceRail({
  spaces,
  activeSpaceId,
  onSelect,
  activeSection,
  onCreateSpace,
}: SpaceRailProps) {
  const showSpaces = Boolean(spaces);

  return (
    <nav
      aria-label="Navigation"
      className="sticky top-0 hidden h-viewport w-rail shrink-0 flex-col items-center border-r border-border-strong bg-surface py-3 lg:flex"
    >
      <Tooltip label="Accueil" side="right">
        <a href="/fil" aria-label="Accueil" className="mb-3">
          <KemetSymbol className="size-8" />
        </a>
      </Tooltip>

      <ul className="flex w-full flex-col items-center gap-1">
        {RAIL_NAV.map((item) => (
          <NavLink key={item.id} item={item} active={activeSection === item.id} />
        ))}
      </ul>

      {showSpaces && (
        <>
          <hr className="my-3 w-6 border-0 border-t border-border-strong" />
          {/* La barre de defilement est masquee ici : sur une colonne de 64 px
              elle recouvrait la moitie des icones. Le rail reste defilable. */}
          <ul className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(spaces ?? []).map((space) => (
              <SpaceButton
                key={space.id}
                space={space}
                active={space.id === activeSpaceId}
                onSelect={onSelect}
              />
            ))}
            {onCreateSpace && (
              <li className="flex w-full justify-center">
                <Tooltip label="Créer un espace" side="right">
                  <IconButton
                    aria-label="Créer un espace"
                    onClick={onCreateSpace}
                    className="hover:bg-accent-soft"
                  >
                    <Plus className="size-5" aria-hidden="true" />
                  </IconButton>
                </Tooltip>
              </li>
            )}
          </ul>
        </>
      )}
    </nav>
  );
}
