import { Hash, Plus } from "lucide-react";
import type { ReactElement } from "react";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { SpaceIcon, spaceTints } from "../ui/SpaceIcon.js";
import { Skeleton } from "../ui/Skeleton.js";
import { Tooltip } from "../ui/Tooltip.js";
import type { ChannelItem, SpaceItem } from "./types.js";

export type SpaceNavigatorStatus = "loading" | "error" | "ready";

export interface SpaceNavigatorProps {
  /** "panel" : panneau Salons du bureau ; "page" : onglet Salons du téléphone. */
  layout: "panel" | "page";
  title: string;
  status: SpaceNavigatorStatus;
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
  /** Sur le bureau, "Créer un espace" vit au pied du panneau : faux ici. */
  canCreateSpace: boolean;
}

/**
 * Une colonne étroite des logos d'espaces, et à côté les seuls salons de
 * l'espace choisi, sous son nom. Même logique sur le bureau et le
 * téléphone : avec trente salons dans un espace, un arbre cacherait les
 * autres espaces.
 */
export function SpaceNavigator({
  layout,
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
}: SpaceNavigatorProps) {
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const tints = spaceTints(spaces);
  const panel = layout === "panel";
  const logoSize = panel ? "size-10" : "size-12";
  const rowClass = cn(
    "flex w-full items-center gap-2 rounded-control px-2 transition-colors duration-150",
    panel ? "h-control text-sm" : "h-control-mobile text-base",
  );
  const textClass = panel ? "text-sm" : "text-base";

  return (
    <div className="flex h-full min-h-0 flex-1">
      <nav
        aria-label={title}
        aria-busy={status === "loading" || undefined}
        className={cn(
          "shrink-0 overflow-y-auto border-r border-border bg-surface py-3",
          panel ? "w-[60px]" : "w-16",
        )}
      >
        {status === "loading" ? (
          <div className="flex flex-col items-center gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className={cn(logoSize, "rounded-card")} />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col items-center gap-2">
            {spaces.map((space) => {
              const active = space.id === activeSpaceId;
              const button: ReactElement = (
                <button
                  type="button"
                  onClick={() => onSelectSpace(space.id)}
                  aria-current={active ? "true" : undefined}
                  aria-label={space.hasUnread ? fr.spaces.spaceWithUnread(space.name) : space.name}
                  className={cn(
                    "relative flex items-center justify-center rounded-card",
                    logoSize,
                    active && "ring-2 ring-action-strong ring-offset-2 ring-offset-surface",
                  )}
                >
                  <SpaceIcon
                    id={space.id}
                    name={space.name}
                    imageUrl={space.imageUrl}
                    tint={tints.get(space.id)}
                    className={cn(logoSize, "rounded-card")}
                  />
                </button>
              );
              return (
                <li key={space.id} className="relative flex w-full justify-center">
                  {active && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 w-1 rounded-r-full bg-action-strong",
                        panel ? "top-1.5 h-7" : "top-2 h-8",
                      )}
                    />
                  )}
                  {panel ? (
                    <Tooltip label={space.name} side="right">
                      {button}
                    </Tooltip>
                  ) : (
                    button
                  )}
                  {space.hasUnread && !active && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-0 size-3 rounded-full border-2 border-surface bg-primary",
                        panel ? "right-1" : "right-2",
                      )}
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
            <p className={cn(textClass, "text-muted")}>{fr.spaces.loadingSpacesError}</p>
            <button
              type="button"
              onClick={onRetry}
              className={cn(textClass, "font-medium text-link hover:underline")}
            >
              {fr.chat.retry}
            </button>
          </div>
        ) : status === "ready" && spaces.length === 0 ? (
          <p className={cn("p-4 text-muted", textClass)}>{fr.spaces.noSpaces}</p>
        ) : (
          <>
            {activeSpace?.imageUrl && (
              <img
                src={activeSpace.imageUrl}
                alt=""
                className={cn("w-full shrink-0 object-cover", panel ? "h-20" : "h-24")}
              />
            )}
            {status === "loading" ? (
              <Skeleton className="mx-3 mb-2 mt-4 h-5 w-32" />
            ) : (
              <h2
                className={cn(
                  "truncate font-semibold text-text",
                  panel ? "px-3 pb-2 pt-3 text-base" : "px-4 pb-2 pt-4 text-md",
                )}
              >
                {spaceName}
              </h2>
            )}
            {channelsLoading || status === "loading" ? (
              <div className="flex flex-col gap-1 px-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton
                    key={index}
                    className={cn("w-full", panel ? "h-control" : "h-control-mobile")}
                  />
                ))}
              </div>
            ) : channelsError ? (
              <div className="flex flex-col items-start gap-1 px-3">
                <p className={cn(textClass, "text-muted")}>{fr.spaces.loadingChannelsError}</p>
                <button
                  type="button"
                  onClick={onRetryChannels}
                  className={cn(textClass, "font-medium text-link hover:underline")}
                >
                  {fr.chat.retry}
                </button>
              </div>
            ) : channels.length === 0 ? (
              <p className={cn("px-3 text-muted", textClass)}>{fr.spaces.noChannels}</p>
            ) : (
              <ul className="flex flex-col gap-0.5 px-2 pb-4">
                {channels.map((channel) => {
                  const active = panel && channel.id === activeChannelId;
                  return (
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
                          rowClass,
                          active
                            ? "bg-nav-active font-semibold text-text"
                            : channel.unreadCount
                              ? "font-semibold text-text hover:bg-surface-2"
                              : "text-text-2 hover:bg-surface-2 hover:text-text",
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
                  );
                })}
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
