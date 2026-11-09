import { MoreHorizontal } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { IconButton } from "./IconButton.js";
import { Menu, type MenuItem } from "./Menu.js";

export interface MoreActionsMenuProps {
  items: MenuItem[];
  onSelect: (value: string) => void;
  /** Ce que le menu concerne, pour le lecteur d'écran : "ce post", "ce skill". */
  label?: string;
}

/**
 * Actions secondaires d'un objet derrière un bouton "…". Une action
 * destructive y vit en élément de danger, jamais en bouton rouge posé seul.
 */
export function MoreActionsMenu({
  items,
  onSelect,
  label = fr.common.moreActions,
}: MoreActionsMenuProps) {
  return (
    <Menu
      trigger={
        <IconButton aria-label={label}>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </IconButton>
      }
      items={items}
      onSelect={onSelect}
    />
  );
}
