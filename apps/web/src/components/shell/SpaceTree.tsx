import { Hash } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { monogramOf } from "../../lib/monogram.js";
import { Skeleton } from "../ui/Skeleton.js";
import type { ChannelItem, SpaceItem } from "./types.js";

export type SpaceTreeStatus = "loading" | "error" | "ready";

export interface SpaceTreeProps {
  title: string;
  status: SpaceTreeStatus;
  onRetry: () => void;
  spaces: SpaceItem[];
  activeSpaceId: string;
  onSelectSpace: (id: string) => void;
  channels: ChannelItem[];
  channelsLoading: boolean;
  activeChannelId: string;
  onSelectChannel: (id: string) => void;
}

const ROW_CLASS =
  "flex h-control w-full items-center gap-2 rounded-control px-2 text-sm transition-colors duration-150";

/**
 * Panneau Salons du bureau : un espace par ligne, nom toujours visible ;
 * l'espace ouvert montre ses salons en dessous.
 */
export function SpaceTree({
  title,
  status,
  onRetry,
  spaces,
  activeSpaceId,
  onSelectSpace,
  channels,
  channelsLoading,
  activeChannelId,
  onSelectChannel,
}: SpaceTreeProps) {
  return (
    <nav aria-label={title} className="px-2 py-3" aria-busy={status === "loading" || undefined}>
      <p className="px-2 pb-2 text-xs font-medium text-muted">{title}</p>
      {status === "loading" ? (
        <RowSkeletons count={3} />
      ) : status === "error" ? (
        <div className="flex flex-col items-start gap-1 px-2">
          <p className="text-sm text-muted">{fr.spaces.loadingSpacesError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-control text-sm font-medium text-link hover:underline"
          >
            {fr.chat.retry}
          </button>
        </div>
      ) : spaces.length === 0 ? (
        <p className="px-2 text-sm text-muted">{fr.spaces.noSpaces}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {spaces.map((space) => {
            const open = space.id === activeSpaceId;
            return (
              <li key={space.id}>
                <button
                  type="button"
                  aria-current={open ? "true" : undefined}
                  aria-label={space.hasUnread ? fr.spaces.spaceWithUnread(space.name) : space.name}
                  onClick={() => onSelectSpace(space.id)}
                  className={cn(
                    ROW_CLASS,
                    open
                      ? "font-medium text-text"
                      : "text-text-2 hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <SpaceAvatar space={space} />
                  <span className="flex-1 truncate text-left">{space.name}</span>
                  {space.hasUnread && !open && (
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
                {open && channelsLoading && (
                  <div className="mt-1 pl-4">
                    <RowSkeletons count={2} />
                  </div>
                )}
                {open && !channelsLoading && channels.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1 pl-4">
                    {channels.map((channel) => (
                      <li key={channel.id}>
                        <ChannelRow
                          channel={channel}
                          active={channel.id === activeChannelId}
                          onSelect={onSelectChannel}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

function ChannelRow({
  channel,
  active,
  onSelect,
}: {
  channel: ChannelItem;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      aria-current={active ? "page" : undefined}
      aria-label={
        channel.unreadCount
          ? fr.spaces.channelWithUnread(channel.name, channel.unreadCount)
          : channel.name
      }
      className={cn(
        ROW_CLASS,
        active
          ? "bg-accent-soft font-medium text-link"
          : "text-text-2 hover:bg-surface-2 hover:text-text",
      )}
    >
      <Hash className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate text-left">{channel.name}</span>
      {channel.unreadCount ? (
        <span
          aria-hidden="true"
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white tabular-nums"
        >
          {channel.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function RowSkeletons({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-control w-full" />
      ))}
    </div>
  );
}

// 6 px : rayon concentrique minimal de DESIGN.md, pour une pastille de 24 px
// posée dans une ligne arrondie à 8 px.
function SpaceAvatar({ space }: { space: SpaceItem }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-accent-soft text-xs font-semibold text-link"
    >
      {space.imageUrl ? (
        <img
          src={space.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        monogramOf(space.name)
      )}
    </span>
  );
}
