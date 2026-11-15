import { Hash } from "lucide-react";
import { cn } from "../../lib/cn.js";
import type { ChannelItem } from "./types.js";
import { fr } from "../../i18n/fr.js";

export interface ChannelListProps {
  spaceName: string;
  channels: ChannelItem[];
  activeChannelId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function ChannelList({ channels, activeChannelId, onSelect, className }: ChannelListProps) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <nav aria-label={fr.messages.segmentSalons} className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-1">
          {channels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                onClick={() => onSelect(channel.id)}
                aria-current={channel.id === activeChannelId ? "page" : undefined}
                className={cn(
                  "flex h-control-mobile w-full items-center gap-2 rounded-control px-2 text-sm text-text-2 transition-colors duration-150 lg:h-9",
                  channel.id === activeChannelId
                    ? "bg-accent-soft font-medium text-primary"
                    : "hover:bg-surface-2 hover:text-text",
                )}
              >
                <Hash className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate text-left">{channel.name}</span>
                {channel.unreadCount ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white tabular-nums">
                    {channel.unreadCount}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
