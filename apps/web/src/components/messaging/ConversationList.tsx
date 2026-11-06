import { Inbox, MessagesSquare } from "lucide-react";
import type { Conversation, ConversationBox } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { cn } from "../../lib/cn.js";
import {
  conversationExcerpt,
  conversationTitle,
  formatConversationTime,
  isAwaitingAcceptance,
} from "../../lib/messaging/conversationLabels.js";
import type { ConversationListState } from "../../lib/messaging/useConversationList.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { Skeleton } from "../ui/Skeleton.js";
import { ConversationAvatar } from "./ConversationAvatar.js";

export interface ConversationListProps {
  box: ConversationBox;
  list: ConversationListState;
  activeConversationId: string | null;
  viewerId: string | null;
}

function ConversationRow({
  box,
  conversation,
  active,
  viewerId,
}: {
  box: ConversationBox;
  conversation: Conversation;
  active: boolean;
  viewerId: string | null;
}) {
  const title = conversationTitle(conversation);
  // La conversation ouverte est en train d'être lue : son compte, chargé
  // avant que la lecture soit enregistrée, n'a plus de sens.
  const unread = !active && conversation.unreadCount > 0;
  const awaiting = isAwaitingAcceptance(conversation);
  const time = conversation.lastMessage?.createdAt ?? conversation.createdAt;
  return (
    <li>
      <a
        // Garde l'onglet Demandes ouvert quand on lit une demande.
        href={`/messages/${conversation.id}${box === "requests" ? "?demandes" : ""}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-control px-2 py-2 hover:bg-surface-2 max-lg:min-h-16",
          active && "bg-accent-soft",
        )}
      >
        <ConversationAvatar conversation={conversation} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-base text-text", unread && "font-semibold")}>
              {title}
            </span>
            <time dateTime={time} className="shrink-0 text-xs text-subtle">
              {formatConversationTime(time)}
            </time>
          </span>
          {conversation.work && (
            <span className="truncate text-xs text-subtle">{fr.messages.aboutWork(conversation.work.title)}</span>
          )}
          <span className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", unread ? "text-text" : "text-muted")}>
              {conversationExcerpt(conversation, viewerId)}
            </span>
            {unread ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium leading-none text-white tabular-nums">
                <span aria-hidden="true">{conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}</span>
                <span className="sr-only">{fr.messages.unreadCount(conversation.unreadCount)}</span>
              </span>
            ) : (
              awaiting && <span className="shrink-0 text-xs text-subtle">{fr.messages.awaitingShort}</span>
            )}
          </span>
        </span>
      </a>
    </li>
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-2" aria-busy="true">
      <span className="sr-only">{fr.messages.loadingList}</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationList({ box, list, activeConversationId, viewerId }: ConversationListProps) {
  if (list.status === "loading") return <ConversationListSkeleton />;
  if (list.status === "error") {
    return (
      <ErrorState
        message={fr.messages.loadingError}
        retry={{ label: fr.chat.retry, onClick: list.reload }}
        className="py-8"
      />
    );
  }
  if (list.items.length === 0) {
    return box === "inbox" ? (
      <EmptyState
        icon={MessagesSquare}
        message={fr.messages.emptyInbox}
        action={{
          label: fr.messages.newConversation,
          onClick: () => (window.location.href = "/messages/nouveau"),
        }}
        className="py-8"
      />
    ) : (
      <EmptyState icon={Inbox} message={fr.messages.emptyRequests} className="py-8" />
    );
  }
  return (
    <div className="flex flex-col p-2">
      <ul aria-label={fr.messages.listLabel} className="flex flex-col gap-0.5">
        {list.items.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            box={box}
            conversation={conversation}
            active={conversation.id === activeConversationId}
            viewerId={viewerId}
          />
        ))}
      </ul>
      {list.hasMore && (
        <Button
          variant="ghost"
          className="mt-2 self-center"
          onClick={() => void list.loadMore()}
          loading={list.loadingMore}
        >
          {fr.messages.loadMore}
        </Button>
      )}
    </div>
  );
}
