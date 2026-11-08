import { navigate } from "../../lib/navigation/navigate.js";
import { ArrowDown, ArrowLeft, MessagesSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isDeletedAccountHandle, type ConversationDetail, type Message } from "@kemet/shared";
import {
  acceptConversation,
  blockUser,
  ChatApiError,
  getConversation,
  leaveConversation,
  unblockUser,
} from "../../lib/chat/api.js";
import { onConversationActivity } from "../../lib/chat/socket.js";
import { buildTimeline } from "../../lib/chat/timeline.js";
import { useChannelMessages } from "../../lib/chat/useChannelMessages.js";
import { useMessageListScroll } from "../../lib/chat/useMessageListScroll.js";
import { refreshConversationUnread } from "../../lib/messaging/conversationUnread.js";
import { conversationTitle } from "../../lib/messaging/conversationLabels.js";
import { useSession } from "../../session/SessionProvider.js";
import { fr } from "../../i18n/fr.js";
import { MessageActionsSheet } from "../chat/MessageActionsSheet.js";
import { OutgoingMessages } from "../chat/OutgoingMessages.js";
import { ReportDialog } from "../moderation/ReportMenu.js";
import { Button } from "../ui/Button.js";
import { Dialog } from "../ui/Dialog.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { MoreActionsMenu } from "../ui/MoreActionsMenu.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useToast } from "../ui/Toast.js";
import { ConversationAvatar } from "./ConversationAvatar.js";
import { ConversationMessages } from "./ConversationMessages.js";
import { MessageComposer } from "./MessageComposer.js";
import { suggestedMessages } from "../works/WorkDiscussion.js";

type LoadState = "loading" | "error" | "notFound" | "ready";
type Confirmation = "block" | "leave" | null;

const MESSAGE_SKELETON = (
  <div className="flex flex-col gap-4" aria-hidden="true">
    <Skeleton className="h-12 w-2/3" />
    <Skeleton className="h-12 w-1/2" />
    <Skeleton className="h-12 w-3/4" />
  </div>
);

export interface ConversationViewProps {
  conversationId: string;
  /** Après avoir quitté ou refusé : la page revient à la liste. */
  onClosed: () => void;
}

export function ConversationView({ conversationId, onClosed }: ConversationViewProps) {
  const toast = useToast();
  const { profile, isSuspended } = useSession();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [busy, setBusy] = useState(false);
  const [reportingConversation, setReportingConversation] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);
  const [actionsMessageId, setActionsMessageId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoadState("loading");
      try {
        const { conversation: detail } = await getConversation(conversationId);
        setConversation(detail);
        setLoadState("ready");
      } catch (error) {
        if (!showLoading) return;
        setLoadState(
          error instanceof ChatApiError && error.statusCode === 404 ? "notFound" : "error",
        );
      }
    },
    [conversationId],
  );

  useEffect(() => {
    void load(true);
    // Une acceptation ou un départ change ce que la personne peut écrire.
    return onConversationActivity((id) => {
      if (id === conversationId) void load(false);
    });
  }, [conversationId, load]);

  const channelId = conversation?.channelId ?? null;
  const {
    messages,
    loading,
    error: messagesError,
    firstUnreadMessageId,
    hasOlder,
    loadingOlder,
    olderError,
    loadOlder,
    reload,
    outgoing,
    send,
    retry,
    discard,
    react,
  } = useChannelMessages(channelId, true, refreshConversationUnread);

  const timeline = useMemo(
    () => buildTimeline(messages, new Date(), { firstUnreadMessageId, hasOlder }),
    [messages, firstUnreadMessageId, hasOlder],
  );
  const { newMessagesBelow, prependingOlder, onScroll, jumpToLatest, requestOlder } =
    useMessageListScroll({
      listRef,
      channelId,
      loading,
      messages,
      hasOlder,
      loadingOlder,
      olderError,
      loadOlder,
      ownProfileId: profile?.id ?? null,
      streamingText: null,
      outgoingCount: outgoing.length,
    });

  // Le premier message envoyé à quelqu'un qui ne connaît pas encore la
  // personne ferme le composeur côté serveur : on relit l'état dès qu'il est
  // confirmé, plutôt que de laisser un champ qui échouera.
  const viewerId = profile?.id ?? null;
  const sentFirstRequest =
    conversation !== null &&
    conversation.writeBlock === null &&
    conversation.participants.length > 0 &&
    conversation.participants.every((participant) => participant.status === "pending") &&
    messages.some((message) => message.authorId === viewerId);
  useEffect(() => {
    if (sentFirstRequest) void load(false);
  }, [sentFirstRequest, load]);

  const nameById = useMemo(() => {
    const entries = (conversation?.participants ?? []).map(
      (participant) => [participant.profileId, participant.displayName] as const,
    );
    return new Map(profile ? [...entries, [profile.id, profile.displayName] as const] : entries);
  }, [conversation, profile]);

  if (loadState !== "ready" || !conversation) {
    return (
      <div className="flex h-full flex-col">
        <ConversationHeaderBar onBack={onClosed} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          {loadState === "loading" ? (
            MESSAGE_SKELETON
          ) : loadState === "notFound" ? (
            <EmptyState
              icon={MessagesSquare}
              message={fr.messages.conversationNotFound}
              action={{ label: fr.messages.backToList, onClick: onClosed }}
            />
          ) : (
            <ErrorState
              message={fr.messages.conversationLoadError}
              retry={{ label: fr.chat.retry, onClick: () => void load(true) }}
            />
          )}
        </div>
      </div>
    );
  }

  const title = conversationTitle(conversation);
  const other = conversation.isGroup ? null : (conversation.participants[0] ?? null);
  const isPending = conversation.viewerStatus === "pending";
  const canWrite = !isSuspended && conversation.writeBlock === null;
  const canReact =
    !isSuspended &&
    conversation.viewerStatus === "accepted" &&
    conversation.writeBlock !== "blocked";
  const firstMessageGoesToRequests =
    canWrite && conversation.participants.every((participant) => participant.status === "pending");
  const actionsMessage = messages.find((message) => message.id === actionsMessageId) ?? null;

  async function runAction(
    action: () => Promise<unknown>,
    messages: { success: string; failure: string },
    after?: () => void,
  ) {
    setBusy(true);
    try {
      await action();
      toast.show(messages.success, "success");
      after?.();
    } catch {
      toast.show(messages.failure, "danger");
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }

  // Le bandeau ou le bouton qui avait le focus disparaît : on le rend au composeur.
  function focusComposerSoon() {
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  function accept() {
    void runAction(
      async () => setConversation((await acceptConversation(conversationId)).conversation),
      { success: fr.messages.accepted, failure: fr.messages.acceptError },
      () => {
        void refreshConversationUnread();
        focusComposerSoon();
      },
    );
  }

  function leave(success: string) {
    void runAction(
      () => leaveConversation(conversationId),
      { success, failure: fr.messages.leaveError },
      () => {
        void refreshConversationUnread();
        onClosed();
      },
    );
  }

  function toggleBlock() {
    if (!other) return;
    if (conversation!.blockedByViewer) {
      void runAction(
        () => unblockUser(other.handle),
        { success: fr.messages.unblocked(other.handle), failure: fr.messages.unblockError },
        () => void load(false).then(focusComposerSoon),
      );
    } else {
      void runAction(
        () => blockUser(other.handle),
        { success: fr.messages.blocked(other.handle), failure: fr.messages.blockError },
        () => void load(false),
      );
    }
  }

  const menuItems = [
    ...(conversation.work ? [{ value: "work", label: fr.messages.viewWork }] : []),
    ...(other ? [{ value: "profile", label: fr.messages.viewProfile }] : []),
    ...(other
      ? [
          conversation.blockedByViewer
            ? { value: "block", label: fr.messages.unblock(other.handle) }
            : { value: "block", label: fr.messages.block(other.handle), danger: true },
        ]
      : []),
    { value: "report", label: fr.messages.reportConversation },
    { value: "leave", label: fr.messages.leave, danger: true },
  ];

  function handleMenu(value: string) {
    if (value === "work" && conversation?.work) navigate(`/travaux/${conversation.work.slug}`);
    else if (value === "profile" && other) navigate(`/u/${other.handle}`);
    else if (value === "block") {
      if (conversation!.blockedByViewer) toggleBlock();
      else setConfirmation("block");
    } else if (value === "report") setReportingConversation(true);
    else if (value === "leave") setConfirmation("leave");
  }

  const writeNotice =
    conversation.writeBlock === "awaiting_acceptance"
      ? conversation.work
        ? fr.messages.teamAwaitingAcceptance
        : fr.messages.awaitingAcceptance(title)
      : conversation.writeBlock === "blocked"
        ? conversation.blockedByViewer && other
          ? fr.messages.blockedByYou(other.displayName)
          : fr.messages.blockedOther
        : conversation.writeBlock === "alone"
          ? fr.messages.alone
          : null;

  return (
    <div className="flex h-full flex-col">
      <ConversationHeaderBar onBack={onClosed}>
        <ConversationAvatar conversation={conversation} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-md font-semibold text-text">
            {other ? (
              <a href={`/u/${other.handle}`} className="hover:underline">
                {title}
              </a>
            ) : (
              title
            )}
          </h2>
          {conversation.work && (
            <>
              <a
                href={`/travaux/${conversation.work.slug}`}
                className="truncate text-xs text-link hover:underline max-md:hidden"
              >
                {fr.messages.aboutWork(conversation.work.title)}
              </a>
              <span className="truncate text-xs text-subtle md:hidden">
                {fr.messages.aboutWork(conversation.work.title)}
              </span>
            </>
          )}
        </div>
        <MoreActionsMenu
          items={menuItems}
          onSelect={handleMenu}
          label={fr.messages.conversationActions}
        />
      </ConversationHeaderBar>

      {isPending && (
        <section
          aria-label={fr.messages.requests}
          className="flex shrink-0 flex-col gap-3 border-b border-border bg-surface px-4 py-3 lg:px-6"
        >
          <p className="text-sm text-text">
            {conversation.work ? fr.messages.teamRequestBanner : fr.messages.requestBanner(title)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={accept} disabled={busy || isSuspended}>
              {fr.messages.accept}
            </Button>
            <Button variant="secondary" onClick={() => leave(fr.messages.declined)} disabled={busy}>
              {fr.messages.decline}
            </Button>
            <Button variant="ghost" onClick={() => setReportingConversation(true)}>
              {fr.messages.report}
            </Button>
          </div>
        </section>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label={fr.messages.messageListLabel(title)}
          aria-relevant="additions"
          aria-live={prependingOlder ? "off" : undefined}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6"
        >
          {loading ? (
            MESSAGE_SKELETON
          ) : messagesError ? (
            <ErrorState
              message={fr.chat.loadingMessagesError}
              retry={{ label: fr.chat.retry, onClick: reload }}
            />
          ) : messages.length === 0 && outgoing.length === 0 ? (
            <EmptyState icon={MessagesSquare} message={fr.messages.conversationStart(title)} />
          ) : (
            <div className="flex flex-col gap-4">
              {loadingOlder ? (
                MESSAGE_SKELETON
              ) : olderError ? (
                <ErrorState
                  message={fr.chat.loadOlderError}
                  retry={{ label: fr.chat.retry, onClick: requestOlder }}
                />
              ) : hasOlder ? (
                <Button variant="ghost" onClick={requestOlder} className="self-center">
                  {fr.chat.loadOlder}
                </Button>
              ) : (
                <p className="text-center text-xs text-subtle">
                  {fr.messages.conversationStart(title)}
                </p>
              )}
              <ConversationMessages
                timeline={timeline}
                viewerId={profile?.id ?? null}
                canReact={canReact}
                onReact={(messageId, emoji) => void react(messageId, emoji)}
                onReport={setReportMessage}
                onOpenActions={setActionsMessageId}
                actionsMessageId={actionsMessageId}
                nameById={nameById}
              />
              {outgoing.length > 0 && profile && (
                <OutgoingMessages
                  messages={outgoing}
                  authorDisplayName={profile.displayName}
                  onRetry={retry}
                  onDiscard={discard}
                />
              )}
            </div>
          )}
        </div>
        {newMessagesBelow > 0 && (
          <Button
            variant="secondary"
            onClick={(event) => {
              jumpToLatest();
              // Au clavier, on peut répondre aussitôt ; au toucher, le clavier
              // virtuel cacherait les messages qu'on vient d'atteindre.
              if (canWrite && event.detail === 0) composerRef.current?.focus();
              else listRef.current?.focus();
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-surface shadow-floating"
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            {fr.chat.jumpToLatest}
          </Button>
        )}
      </div>
      <p role="status" className="sr-only">
        {loadingOlder ? fr.chat.loadingOlder : ""}
      </p>

      {canWrite && channelId ? (
        <MessageComposer
          textareaRef={composerRef}
          channelId={channelId}
          placeholder={fr.messages.composerPlaceholder(title)}
          // La note de confidentialité accompagne le premier message, pas chaque échange.
          notice={
            firstMessageGoesToRequests
              ? conversation.work
                ? fr.messages.teamFirstMessageNotice
                : fr.messages.firstMessageNotice(title)
              : messages.length === 0
                ? fr.messages.privacyNote
                : undefined
          }
          onSend={(body, attachmentIds) => send(body, null, attachmentIds)}
          // Une conversation d'équipe vide n'est visible que de qui l'a ouverte.
          suggestions={
            conversation.work && messages.length === 0
              ? suggestedMessages({ title: conversation.work.title, tags: [] })
              : undefined
          }
        />
      ) : (
        writeNotice && (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-border p-3">
            <p className="flex-1 text-sm text-text-2">{writeNotice}</p>
            {conversation.blockedByViewer && other && (
              <Button variant="secondary" onClick={toggleBlock} disabled={busy}>
                {fr.messages.unblock(other.handle)}
              </Button>
            )}
          </div>
        )
      )}

      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={
          confirmation === "block" && other
            ? fr.messages.blockTitle(other.handle)
            : fr.messages.leaveTitle
        }
        description={
          confirmation === "block" ? fr.messages.blockDescription : fr.messages.leaveDescription
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmation(null)}>
            {fr.common.cancel}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={() => (confirmation === "block" ? toggleBlock() : leave(fr.messages.left))}
          >
            {confirmation === "block" ? fr.messages.blockConfirm : fr.messages.leaveConfirm}
          </Button>
        </div>
      </Dialog>

      <ReportDialog
        contentType="conversation"
        contentId={conversation.id}
        authorId={other?.profileId ?? conversation.id}
        authorHandle={other ? other.handle : title}
        allowProfile={Boolean(other) && !isDeletedAccountHandle(other!.handle)}
        open={reportingConversation}
        onClose={() => setReportingConversation(false)}
      />
      {reportMessage && (
        <ReportDialog
          contentType="message"
          contentId={reportMessage.id}
          authorId={reportMessage.authorId}
          authorHandle={reportMessage.authorHandle}
          open
          onClose={() => setReportMessage(null)}
        />
      )}
      {actionsMessage && (
        <MessageActionsSheet
          open
          onOpenChange={(open) => !open && setActionsMessageId(null)}
          onReact={() => void react(actionsMessage.id, "👍")}
          onCopy={
            actionsMessage.body && !actionsMessage.deletedAt
              ? () =>
                  void navigator.clipboard.writeText(actionsMessage.body).then(
                    () => toast.show(fr.chat.textCopied, "success"),
                    () => toast.show(fr.chat.copyError, "danger"),
                  )
              : undefined
          }
          onReport={
            actionsMessage.authorId !== profile?.id && !actionsMessage.deletedAt
              ? () => setReportMessage(actionsMessage)
              : undefined
          }
        />
      )}
    </div>
  );
}

function ConversationHeaderBar({ onBack, children }: { onBack: () => void; children?: ReactNode }) {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-3 border-b border-border px-3 py-1 lg:h-14 lg:px-4">
      <a
        href="/messages"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
        aria-label={fr.messages.backToList}
        className="inline-flex size-control-mobile items-center justify-center rounded-control text-text hover:bg-surface-2 lg:hidden"
      >
        <ArrowLeft className="size-5" aria-hidden="true" />
      </a>
      {children}
    </header>
  );
}
