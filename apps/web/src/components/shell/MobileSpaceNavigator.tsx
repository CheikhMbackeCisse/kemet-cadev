import { Hash, Plus } from "lucide-react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { monogramOf } from "../../lib/monogram.js";
import { Skeleton } from "../ui/Skeleton.js";
import type { SpaceTreeStatus } from "./SpaceTree.js";
import type { ChannelItem, SpaceItem } from "./types.js";

export interface MobileSpaceNavigatorProps {
  title: string;
  status: SpaceTreeStatus;
  onRetry: () => void;
  spaces: SpaceItem[];
  activeSpaceId: string;
  onSelectSpace: (id: string) => void;
  spaceName: string;
  channels: ChannelItem[];
  channelsLoading: boolean;
  channelsError: boolean;
  onRetryChannels: () => void;
  activeChannelId: string;
  onSelectChannel: (id: string) => void;
  canCreateSpace: boolean;
}

/**
 * Onglet Salons sur téléphone : une colonne étroite des espaces à gauche,
 * les salons de l'espace choisi à droite. Passer d'un espace à l'autre ne
 * quitte pas l'onglet ; toucher un salon ouvre la discussion.
 */
export function MobileSpaceNavigator({
  title,
  status,
  onRetry,
  spaces,
  activeSpaceId,
  onSelectSpace,
  spaceName,
  channels,
  channelsLoading,
  channelsError,
  onRetryChannels,
  activeChannelId,
  onSelectChannel,
  canCreateSpace,
}: MobileSpaceNavigatorProps) {
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);

  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label={title}
        className="w-16 shrink-0 overflow-y-auto border-r border-border bg-surface py-3"
      >
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="size-12 rounded-card" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col items-center gap-2">
            {spaces.map((space) => {
              const active = space.id === activeSpaceId;
              return (
                <li key={space.id} className="relative flex w-full justify-center">
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-primary"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space.id)}
                    aria-current={active ? "true" : undefined}
                    aria-label={
                      space.hasUnread ? fr.spaces.spaceWithUnread(space.name) : space.name
                    }
                    className={cn(
                      "relative flex size-12 items-center justify-center overflow-hidden rounded-card text-sm font-semibold transition-colors duration-150",
                      active ? "bg-primary text-white" : "bg-accent-soft text-link",
                    )}
                  >
                    {space.imageUrl ? (
                      <img src={space.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      monogramOf(space.name)
                    )}
                  </button>
                  {space.hasUnread && !active && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-0 size-3 rounded-full border-2 border-surface bg-primary"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <section
        aria-label={spaceName || title}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {status === "error" ? (
          <div className="flex flex-col items-start gap-1 p-4">
            <p className="text-base text-muted">{fr.spaces.loadingSpacesError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-base font-medium text-link hover:underline"
            >
              {fr.chat.retry}
            </button>
          </div>
        ) : status === "ready" && spaces.length === 0 ? (
          <p className="p-4 text-base text-muted">{fr.spaces.noSpaces}</p>
        ) : (
          <>
            {activeSpace?.imageUrl && (
              <img
                src={activeSpace.imageUrl}
                alt=""
                className="h-24 w-full shrink-0 object-cover"
              />
            )}
            {status === "loading" ? (
              <Skeleton className="mx-4 mb-2 mt-4 h-5 w-32" />
            ) : (
              <h2 className="truncate px-4 pb-2 pt-4 text-md font-semibold text-text">{spaceName}</h2>
            )}
            {channelsLoading || status === "loading" ? (
              <div className="flex flex-col gap-1 px-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-control-mobile w-full" />
                ))}
              </div>
            ) : channelsError ? (
              <div className="flex flex-col items-start gap-1 px-4">
                <p className="text-base text-muted">{fr.spaces.loadingChannelsError}</p>
                <button
                  type="button"
                  onClick={onRetryChannels}
                  className="text-base font-medium text-link hover:underline"
                >
                  {fr.chat.retry}
                </button>
              </div>
            ) : channels.length === 0 ? (
              <p className="px-4 text-base text-muted">{fr.spaces.noChannels}</p>
            ) : (
              <ul className="flex flex-col gap-1 px-2 pb-4">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      onClick={() => onSelectChannel(channel.id)}
                      aria-current={channel.id === activeChannelId ? "page" : undefined}
                      aria-label={
                        channel.unreadCount
                          ? fr.spaces.channelWithUnread(channel.name, channel.unreadCount)
                          : channel.name
                      }
                      className={cn(
                        "flex h-control-mobile w-full items-center gap-2 rounded-control px-2 text-base transition-colors duration-150",
                        channel.unreadCount ? "font-semibold text-text" : "text-text-2",
                        "hover:bg-surface-2",
                      )}
                    >
                      <Hash className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="flex-1 truncate text-left">{channel.name}</span>
                      {channel.unreadCount ? (
                        <span
                          aria-hidden="true"
                          className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white tabular-nums"
                        >
                          {channel.unreadCount > 9 ? "9+" : channel.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {canCreateSpace && (
          <a
            href="/salons/nouveau"
            className="mx-2 mb-4 mt-auto flex h-control-mobile items-center gap-2 rounded-control px-2 text-base font-medium text-link hover:bg-surface-2"
          >
            <Plus className="size-4 shrink-0" aria-hidden="true" />
            {fr.spaces.createTitle}
          </a>
        )}
      </section>
    </div>
  );
}
