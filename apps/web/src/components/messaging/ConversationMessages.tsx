import { Flag, SmilePlus } from "lucide-react";
import { useState } from "react";
import type { Message } from "@kemet/shared";
import type { TimelineItem } from "../../lib/chat/timeline.js";
import { useLongPress } from "../../lib/chat/useLongPress.js";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import { MessageAttachments } from "../chat/MessageAttachments.js";
import { DaySeparator, UnreadSeparator } from "../chat/TimelineSeparator.js";
import { RichText } from "../content/RichText.js";
import { Avatar } from "../ui/Avatar.js";
import { IconButton } from "../ui/IconButton.js";
import { Tooltip } from "../ui/Tooltip.js";
import { UserName } from "../ui/UserName.js";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export interface ConversationMessagesProps {
  timeline: TimelineItem[];
  viewerId: string | null;
  /** Faux tant que la demande n'est pas acceptée : on lit sans réagir. */
  canReact: boolean;
  onReact: (messageId: string, emoji: string) => void;
  onReport: (message: Message) => void;
  /** Appui long sur écran tactile : la feuille d'actions du message. */
  onOpenActions: (messageId: string) => void;
  /** Message dont la feuille d'actions est ouverte, surligné comme dans un salon. */
  actionsMessageId: string | null;
  /** Noms des membres par identifiant, pour l'infobulle des réactions. */
  nameById: Map<string, string>;
}

export function ConversationMessages({
  timeline,
  viewerId,
  canReact,
  onReact,
  onReport,
  onOpenActions,
  actionsMessageId,
  nameById,
}: ConversationMessagesProps) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { bind: bindLongPress } = useLongPress(onOpenActions);

  return timeline.map((item) => {
    if (item.type === "unread") return <UnreadSeparator key={item.key} />;
    if (item.type === "day") return <DaySeparator key={item.key} label={item.label} />;
    const { group } = item;
    return (
      <div key={group.messages[0]!.id} className="flex flex-col gap-1">
        {group.messages.map((message, index) => {
          const isOwn = message.authorId === viewerId;
          return (
            <div
              key={message.id}
              {...(canReact ? bindLongPress(message.id) : {})}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("a, button")) return;
                setSelectedMessageId((current) => (current === message.id ? null : message.id));
              }}
              className={cn(
                "group/message relative -mx-2 flex gap-3 rounded-control px-2 py-0.5 lg:hover:bg-surface-2",
                canReact && "[@media(pointer:coarse)]:select-none",
                (selectedMessageId === message.id || actionsMessageId === message.id) &&
                  "bg-surface-2",
              )}
            >
              <div className="flex w-8 shrink-0 items-start justify-center">
                {index === 0 ? (
                  <a
                    href={`/u/${group.authorHandle}`}
                    aria-label={fr.profile.viewProfile(group.authorDisplayName)}
                  >
                    <Avatar
                      name={group.authorDisplayName}
                      src={group.authorAvatarUrl ?? undefined}
                      countryCode={group.authorCountry ?? undefined}
                    />
                  </a>
                ) : (
                  <span className="pt-1 text-xs leading-none text-subtle">
                    {formatTime(message.createdAt)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {index === 0 && (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <UserName
                      name={group.authorDisplayName}
                      handle={group.authorHandle}
                      level={group.authorLevel}
                    />
                    <span className="text-xs text-subtle">{formatTime(message.createdAt)}</span>
                  </div>
                )}
                {message.body && (
                  <RichText
                    source={message.body}
                    className="mt-0.5 text-base text-text"
                    suffix={
                      message.editedAt && (
                        <span className="text-xs text-subtle">({fr.chat.edited})</span>
                      )
                    }
                  />
                )}
                <MessageAttachments attachments={message.attachments} />
                {message.reactions.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {message.reactions.map((reaction) => {
                      const names = reaction.profileIds.map((profileId) => nameById.get(profileId));
                      const label = fr.chat.reactionLabel(
                        reaction.emoji,
                        reaction.profileIds.length,
                      );
                      // Tous les membres sont connus : la liste des noms est toujours complète.
                      const tooltip = names.every(Boolean) ? names.join(", ") : label;
                      return (
                        <Tooltip key={reaction.emoji} label={tooltip}>
                          {canReact ? (
                            <button
                              type="button"
                              onClick={() => onReact(message.id, reaction.emoji)}
                              aria-label={label}
                              className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs hover:bg-accent-soft max-md:min-h-11 max-md:px-3"
                            >
                              {reaction.emoji} {reaction.profileIds.length}
                            </button>
                          ) : (
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle">
                              {reaction.emoji} {reaction.profileIds.length}
                            </span>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
              {canReact && (
                <div
                  role="toolbar"
                  aria-label={fr.chat.messageActions}
                  className={cn(
                    "pointer-events-none absolute -top-3 right-2 flex items-center gap-0.5 rounded-control border border-border bg-surface p-0.5 opacity-0 transition-opacity duration-150",
                    "focus-within:pointer-events-auto focus-within:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100",
                    selectedMessageId === message.id && "pointer-events-auto opacity-100",
                  )}
                >
                  <IconButton
                    aria-label={fr.chat.addReaction}
                    onClick={() => onReact(message.id, "👍")}
                  >
                    <SmilePlus className="size-4" aria-hidden="true" />
                  </IconButton>
                  {!isOwn && (
                    <IconButton
                      aria-label={fr.moderation.reportAction}
                      onClick={() => onReport(message)}
                    >
                      <Flag className="size-4" aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  });
}
