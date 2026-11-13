import type { LucideIcon } from "lucide-react";

export interface SpaceItem {
  id: string;
  name: string;
  /** Image de l'espace. Absente : logo de sa technologie ou icône (SpaceIcon). */
  imageUrl?: string | null;
  hasUnread?: boolean;
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
