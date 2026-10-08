import { IconButton } from "../ui/IconButton.js";
import { KemetSymbol } from "../ui/KemetSymbol.js";
import type { SpaceItem } from "./types.js";

export interface SpaceRailProps {
  spaces: SpaceItem[];
  activeSpaceId: string;
  onSelect: (id: string) => void;
}

export function SpaceRail({ spaces, activeSpaceId, onSelect }: SpaceRailProps) {
  return (
    <nav
      aria-label="Espaces"
      className="hidden w-rail shrink-0 flex-col items-center gap-2 border-r border-border bg-surface py-3 lg:flex"
    >
      <KemetSymbol className="mb-2 size-8" />
      {spaces.map((space) => (
        <IconButton
          key={space.id}
          aria-label={space.name}
          active={space.id === activeSpaceId}
          onClick={() => onSelect(space.id)}
        >
          <space.icon className="size-5" aria-hidden="true" />
        </IconButton>
      ))}
    </nav>
  );
}
