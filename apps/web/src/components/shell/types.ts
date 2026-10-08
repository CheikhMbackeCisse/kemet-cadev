import type { LucideIcon } from "lucide-react";

export interface SpaceItem {
  id: string;
  name: string;
  icon: LucideIcon;
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
