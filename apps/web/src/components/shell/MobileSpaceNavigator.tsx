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
                      active ? "bg-primary text-white" : "bg-accent-soft text-primary",
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
            {canCreateSpace && (
              <li>
                <a
                  href="/salons/nouveau"
                  aria-label={fr.spaces.createTitle}
                  className="flex size-12 items-center justify-center rounded-card border border-dashed border-border-strong text-primary hover:bg-surface-2"
                >
                  <Plus className="size-5" aria-hidden="true" />
                </a>
              </li>
            )}
          </ul>
        )}
      </nav>

      <section
        aria-label={spaceName || title}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
        {status === "error" ? (
          <div className="flex flex-col items-start gap-1 p-4">
            <p className="text-sm text-muted">{fr.spaces.loadingSpacesError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-medium text-link hover:underline"
            >
              {fr.chat.retry}
            </button>
          </div>
        ) : status === "ready" && spaces.length === 0 ? (
          <p className="p-4 text-sm text-muted">{fr.spaces.noSpaces}</p>
        ) : (
          <>
            {activeSpace?.imageUrl && (
              <img
                src={activeSpace.imageUrl}
                alt=""
                className="h-24 w-full shrink-0 object-cover"
              />
            )}
            <h2 className="truncate px-4 pb-2 pt-4 text-md font-semibold text-text">{spaceName}</h2>
            {channelsLoading || status === "loading" ? (
              <div className="flex flex-col gap-1 px-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-control-mobile w-full" />
                ))}
              </div>
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
                        "flex h-control-mobile w-full items-center gap-2 rounded-control px-2 text-md transition-colors duration-150",
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
                          {channel.unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
