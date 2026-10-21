import type { LucideIcon } from "lucide-react";

export interface SpaceItem {
  id: string;
  name: string;
  /** Image de l'espace. Absente : le rail affiche son monogramme. */
  imageUrl?: string | null;
}

export interface ChannelItem {
  id: string;
  name: string;
  unreadCount?: number;
}

export interface MobileTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}
