import {
  ArrowDown,
  Download,
  Hash,
  MessageSquare,
  MessageSquareReply,
  Paperclip,
  Send,
  SmilePlus,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  addSpaceMember,
  attachmentUrl,
  ChatApiError,
  createInvite,
  listChannels,
  listSpaceMembers,
  listSpaces,
  removeSpaceMember,
  uploadAttachment,
} from "../lib/chat/api.js";
import { useChannelMessages } from "../lib/chat/useChannelMessages.js";
import { buildTimeline } from "../lib/chat/timeline.js";
import { takeDraftFocusRequest, useChannelDraft } from "../lib/chat/useChannelDraft.js";
import {
  UNREAD_SEPARATOR_ATTRIBUTE,
  useMessageListScroll,
} from "../lib/chat/useMessageListScroll.js";
import { AssistantMessage } from "../components/assistant/AssistantMessage.js";
import { RichText } from "../components/content/RichText.js";
import { AccountMenu } from "../components/shell/AccountMenu.js";
import { AppShell } from "../components/shell/AppShell.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { OutgoingMessages } from "../components/chat/OutgoingMessages.js";
import { MessageActionsSheet } from "../components/chat/MessageActionsSheet.js";
import {
  MENTION_LISTBOX_ID,
  MentionSuggestions,
  mentionOptionId,
} from "../components/chat/MentionSuggestions.js";
import { useMentionAutocomplete } from "../lib/chat/useMentionAutocomplete.js";
import { useThread } from "../lib/chat/useThread.js";
import { useMediaQuery } from "../lib/useMediaQuery.js";
import { ThreadView } from "../components/chat/ThreadView.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useLongPress } from "../lib/chat/useLongPress.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { ReportDialog, ReportMenu } from "../components/moderation/ReportMenu.js";
import type { ChannelItem, SpaceItem } from "../components/shell/types.js";
import { useSession } from "../session/SessionProvider.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  markAssistantNoticeSeen,
  mentionsAssistant,
  shouldShowAssistantNotice,
} from "../lib/chat/assistantNotice.js";
import { Tooltip } from "../components/ui/Tooltip.js";
import { useToast } from "../components/ui/Toast.js";
import { UserName } from "../components/ui/UserName.js";
import { formatCount } from "../lib/formatCount.js";
import { cn } from "../lib/cn.js";
import { fr } from "../i18n/fr.js";
import {
  KEMET_HANDLE,
  type Attachment,
  type Channel,
  type Space,
  type SpaceMember,
} from "@kemet/shared";

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function writeParams(params: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  window.history.replaceState(null, "", url.toString());
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function SpacePage() {
  const toast = useToast();
  const { status, profile, isSuspended } = useSession();
  const canInteract = status === "ready";
  // Un compte suspendu garde la lecture (canInteract) mais pas l'écriture :
  // composeur, réactions et signalement s'appuient sur canWrite plutôt que
  // sur canInteract.
  const canWrite = canInteract && !isSuspended;
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(readParam("space"));

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(readParam("channel"));

  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [membersNextCursor, setMembersNextCursor] = useState<string | null>(null);
  const [membersLoadingMore, setMembersLoadingMore] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(false);
  const [draft, setDraft] = useChannelDraft(activeChannelId);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [memberHandle, setMemberHandle] = useState("");
  // Sur écran tactile, sans survol : un appui sur un message montre ses
  // actions, un second appui les cache.
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [actionsMessageId, setActionsMessageId] = useState<string | null>(null);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const threadTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => setThreadParentId(null), [activeChannelId]);

  function openThread(messageId: string) {
    threadTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setThreadParentId(messageId);
  }

  function closeThread() {
    setThreadParentId(null);
    const trigger = threadTriggerRef.current;
    threadTriggerRef.current = null;
    // Au toucher, le bouton qui a ouvert le fil ne prend pas le focus : on
    // revient à la liste, pas au composeur qui ouvrirait le clavier.
    // Après le démontage : la fenêtre modale retient le focus tant qu'elle est là.
    requestAnimationFrame(() => {
      if (trigger?.isConnected && trigger !== document.body) trigger.focus();
      else messageListRef.current?.focus();
    });
  }
  const { bind: bindLongPress } = useLongPress(setActionsMessageId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mentions = useMentionAutocomplete({
    draft,
    setDraft,
    textareaRef: composerRef,
    members,
    ownProfileId: profile?.id ?? null,
    assistantLabel: fr.chat.assistantName,
  });

  // Sur mobile, le clavier ouvert cacherait le salon : le focus attend un appui.
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer || !activeChannelId || !canWrite) return;
    if (!takeDraftFocusRequest(activeChannelId)) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    composer.focus();
    composer.setSelectionRange(composer.value.length, composer.value.length);
  }, [activeChannelId, canWrite]);

  function switchChannel(channelId: string) {
    // Une pièce jointe appartient à son salon (le serveur la refuserait
    // ailleurs) ; le brouillon de texte, lui, reste gardé par salon.
    setPendingAttachments([]);
    setActiveChannelId(channelId);
  }

  const refreshSpaces = useCallback(async () => {
    setSpacesLoading(true);
    setSpacesError(false);
    try {
      const page = await listSpaces();
      setSpaces(page.items);
      setActiveSpaceId((current) => current ?? page.items[0]?.id ?? null);
    } catch {
      setSpacesError(true);
    } finally {
      setSpacesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSpaces();
  }, [refreshSpaces]);

  const refreshChannels = useCallback(async (spaceId: string) => {
    setChannelsLoading(true);
    setChannelsError(false);
    try {
      const page = await listChannels(spaceId);
      setChannels(page.items);
      setActiveChannelId((current) => current ?? page.items[0]?.id ?? null);
    } catch {
      setChannelsError(true);
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSpaceId) void refreshChannels(activeSpaceId);
  }, [activeSpaceId, refreshChannels]);

  const refreshMembers = useCallback(async (spaceId: string) => {
    setMembersLoading(true);
    setMembersError(false);
    try {
      const page = await listSpaceMembers(spaceId);
      setMembers(page.items);
      setMembersNextCursor(page.nextCursor);
    } catch {
      setMembersError(true);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    // Un visiteur n'a pas accès à la liste des membres.
    if (activeSpaceId && canInteract) void refreshMembers(activeSpaceId);
  }, [activeSpaceId, canInteract, refreshMembers]);

  async function loadMoreMembers() {
    if (!activeSpaceId || !membersNextCursor) return;
    setMembersLoadingMore(true);
    try {
      const page = await listSpaceMembers(activeSpaceId, membersNextCursor);
      setMembers((current) => [...current, ...page.items]);
      setMembersNextCursor(page.nextCursor);
    } finally {
      setMembersLoadingMore(false);
    }
  }

  useEffect(() => {
    if (activeSpaceId && activeChannelId)
      writeParams({ space: activeSpaceId, channel: activeChannelId });
  }, [activeSpaceId, activeChannelId]);

  const {
    messages,
    loading,
    error: messagesError,
    firstUnreadMessageId,
    hasOlder,
    loadingOlder,
    olderError,
    loadOlder,
    assistantStream,
    assistantMetaByMessageId,
    reload: reloadMessages,
    outgoing,
    send,
    retry,
    discard,
    react,
    giveAssistantFeedback,
  } = useChannelMessages(activeChannelId, canInteract);

  const spaceItems: SpaceItem[] = useMemo(
    () =>
      spaces.map((space) => ({
        id: space.id,
        name: space.name,
        hasUnread: space.hasUnread && space.id !== activeSpaceId,
      })),
    [spaces, activeSpaceId],
  );

  const channelItems: ChannelItem[] = useMemo(
    () =>
      channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        unreadCount: channel.unreadCount,
      })),
    [channels],
  );

  // Ne résout que les membres déjà chargés dans le panneau de droite : une personne qui
  // a réagi mais n'est pas (encore) dans la page de membres chargée reste anonyme dans
  // l'infobulle, qui retombe alors sur le simple compte.
  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.profileId, member.displayName])),
    [members],
  );

  const timeline = useMemo(
    () => buildTimeline(messages, new Date(), { firstUnreadMessageId, hasOlder }),
    [messages, firstUnreadMessageId, hasOlder],
  );

  const { newMessagesBelow, prependingOlder, onScroll, jumpToLatest, requestOlder } =
    useMessageListScroll({
      listRef: messageListRef,
      channelId: activeChannelId,
      loading,
      messages,
      hasOlder,
      loadingOlder,
      olderError,
      loadOlder,
      ownProfileId: profile?.id ?? null,
      streamingText: assistantStream?.text ?? null,
      outgoingCount: outgoing.length,
    });

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
  // Le bouton cède la place au squelette pendant le chargement : le focus passe
  // à la liste plutôt que de retomber sur le document.
  function requestOlderFromButton() {
    messageListRef.current?.focus();
    requestOlder();
  }
  const activeChannelName = channels.find((channel) => channel.id === activeChannelId)?.name;
  // Le serveur refuse deja ces actions aux simples membres : la condition ne
  // fait qu'eviter de leur montrer des boutons qui echoueront.
  const canManageMembers =
    canWrite && (activeSpace?.role === "owner" || activeSpace?.role === "admin");

  // Sur écran tactile, Entrée va à la ligne et seul le bouton envoie : le
  // clavier virtuel n'a pas de Maj+Entrée commode.
  const enterSends = useMemo(() => !window.matchMedia("(pointer: coarse)").matches, []);

  const actionsMessage = messages.find((message) => message.id === actionsMessageId) ?? null;
  const threadParent = messages.find((message) => message.id === threadParentId) ?? null;
  const thread = useThread(activeChannelId, threadParent?.id ?? null);
  const threadView = threadParent && (
    <ThreadView
      parent={threadParent}
      replies={thread.replies}
      outgoing={thread.outgoing}
      loading={thread.loading}
      error={thread.error}
      onReload={thread.reload}
      onSend={thread.send}
      onRetry={thread.retry}
      onDiscard={thread.discard}
      onClose={closeThread}
      fullScreen={!isDesktop}
      canWrite={canWrite}
      enterSends={enterSends}
      ownDisplayName={profile?.displayName ?? null}
    />
  );
  const reportMessage = messages.find((message) => message.id === reportMessageId) ?? null;

  async function copyMessage(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      toast.show(fr.chat.textCopied, "success");
    } catch {
      toast.show(fr.chat.copyError, "danger");
    }
  }

  const showAssistantNotice = shouldShowAssistantNotice(draft);

  function handleSend() {
    const body = draft.trim();
    const attachments = pendingAttachments;
    if (!body && attachments.length === 0) return;
    setDraft("");
    setPendingAttachments([]);
    composerRef.current?.focus();
    send(
      body,
      null,
      attachments.map((attachment) => attachment.id),
    );
    if (mentionsAssistant(body)) markAssistantNoticeSeen();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeChannelId) return;
    setUploadingAttachment(true);
    try {
      const attachment = await uploadAttachment(activeChannelId, file);
      setPendingAttachments((current) => [...current, attachment]);
    } catch (error) {
      toast.show(
        error instanceof ChatApiError ? error.message : fr.chat.attachmentUploadError,
        "danger",
      );
    } finally {
      setUploadingAttachment(false);
    }
  }

  function removePendingAttachment(attachmentId: string) {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }

  async function handleAddMember() {
    if (!activeSpaceId || !memberHandle.trim()) return;
    try {
      await addSpaceMember(activeSpaceId, memberHandle.trim());
      setMemberHandle("");
      const page = await listSpaceMembers(activeSpaceId);
      setMembers(page.items);
    } catch {
      toast.show(fr.spaces.actionError, "danger");
    }
  }

  async function handleRemoveMember(profileId: string) {
    if (!activeSpaceId) return;
    try {
      await removeSpaceMember(activeSpaceId, profileId);
      const page = await listSpaceMembers(activeSpaceId);
      setMembers(page.items);
    } catch {
      toast.show(fr.spaces.actionError, "danger");
    }
  }

  async function handleCreateInvite() {
    if (!activeSpaceId) return;
    try {
      const { invite } = await createInvite(activeSpaceId, {});
      const url = `${window.location.origin}/salons/invite/${invite.code}`;
      await navigator.clipboard.writeText(url);
      toast.show(fr.invites.linkCopied, "success");
    } catch {
      toast.show(fr.invites.createError, "danger");
    }
  }

  return (
    <>
      <AppShell
        spaces={{
          title: canInteract ? fr.shell.mySpaces : fr.shell.publicSpaces,
          items: spaceItems,
          activeSpaceId: activeSpaceId ?? "",
          onSelect: (id) => {
            setActiveSpaceId(id);
            setActiveChannelId(null);
          },
          status: spacesLoading ? "loading" : spacesError ? "error" : "ready",
          onRetry: () => void refreshSpaces(),
          channelsLoading,
          canCreateSpace: canWrite,
        }}
        channelList={{
          // Le nombre de membres est déjà dans le titre du panneau de droite.
          spaceName: activeSpace?.name ?? "",
          channels: channelItems,
          activeChannelId: activeChannelId ?? "",
          onSelect: switchChannel,
        }}
        activeMobileTabId="salons"
        topBarExtra={<AccountMenu />}
        rightPanel={
          !canInteract
            ? undefined
            : {
                title: activeSpace
                  ? fr.spaces.membersWithCount(formatCount(activeSpace.memberCount))
                  : fr.spaces.members,
                content: (
                  <div className="flex flex-col gap-4 text-sm">
                    <div className="flex flex-col gap-1">
                      {membersLoading ? (
                        <div className="flex flex-col gap-2" aria-busy="true">
                          <span className="sr-only">{fr.spaces.loadingMembers}</span>
                          {[0, 1, 2, 3].map((index) => (
                            <div key={index} className="flex items-center gap-2 px-1 py-1">
                              <Skeleton className="size-8 rounded-full" />
                              <div className="flex flex-1 flex-col gap-1">
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-3 w-1/3" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : membersError ? (
                        <ErrorState
                          message={fr.spaces.loadingMembersError}
                          retry={{
                            label: fr.chat.retry,
                            onClick: () => activeSpaceId && refreshMembers(activeSpaceId),
                          }}
                        />
                      ) : members.length === 0 ? (
                        <EmptyState icon={Users} message={fr.spaces.noMembers} className="py-6" />
                      ) : (
                        members.map((member) => (
                          <div
                            key={member.profileId}
                            className="group flex items-center justify-between gap-2 rounded-control px-1 py-1 hover:bg-surface-2"
                          >
                            <a
                              href={`/u/${member.handle}`}
                              className="flex min-w-0 items-center gap-2"
                              aria-label={fr.profile.viewProfile(member.displayName)}
                            >
                              <Avatar
                                name={member.displayName}
                                src={member.avatarUrl ?? undefined}
                                size={32}
                                countryCode={member.country}
                              />
                              <span className="flex min-w-0 flex-col">
                                <UserName name={member.displayName} className="truncate" />
                                <span className="truncate text-xs text-subtle">
                                  @{member.handle}
                                </span>
                              </span>
                            </a>
                            {canManageMembers && member.role !== "owner" && (
                              <IconButton
                                aria-label={fr.spaces.removeMember}
                                // Toujours visible sous lg : le panneau y devient une
                                // feuille tactile, ou le survol n'existe pas.
                                className="transition-opacity max-lg:opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                                onClick={() => handleRemoveMember(member.profileId)}
                              >
                                <UserX className="size-4" aria-hidden="true" />
                              </IconButton>
                            )}
                          </div>
                        ))
                      )}
                      {membersNextCursor && (
                        <Button
                          variant="secondary"
                          className="mt-2 self-start text-xs"
                          onClick={loadMoreMembers}
                          disabled={membersLoadingMore}
                        >
                          {fr.spaces.loadMoreMembers}
                        </Button>
                      )}
                    </div>
                    {canManageMembers && (
                      <div className="flex flex-col gap-2 border-t border-border pt-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder={fr.spaces.memberHandlePlaceholder}
                            aria-label={fr.spaces.memberHandlePlaceholder}
                            value={memberHandle}
                            onChange={(event) => setMemberHandle(event.target.value)}
                          />
                          <Button onClick={handleAddMember} aria-label={fr.spaces.addMember}>
                            <UserPlus className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <Button variant="secondary" onClick={handleCreateInvite}>
                          {fr.invites.createTitle}
                        </Button>
                      </div>
                    )}
                  </div>
                ),
              }
        }
      >
        <div className="flex h-full flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={messageListRef}
              onScroll={onScroll}
              role="log"
              aria-label={fr.chat.messageList}
              // Seuls les nouveaux messages sont lus : sans aria-relevant, chaque
              // réaction ajoutée serait aussi annoncée.
              aria-relevant="additions"
              aria-live={prependingOlder ? "off" : undefined}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6"
            >
              {spacesLoading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-12 w-1/2" />
                </div>
              ) : spacesError ? (
                <ErrorState
                  message={fr.spaces.loadingSpacesError}
                  retry={{ label: fr.chat.retry, onClick: refreshSpaces }}
                />
              ) : spaces.length === 0 ? (
                <EmptyState
                  icon={Hash}
                  message={fr.spaces.noSpaces}
                  action={{
                    label: fr.spaces.createTitle,
                    onClick: () => (window.location.href = "/salons/nouveau"),
                  }}
                />
              ) : channelsLoading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-12 w-1/2" />
                  <Skeleton className="h-12 w-3/4" />
                </div>
              ) : channelsError ? (
                <ErrorState
                  message={fr.spaces.loadingChannelsError}
                  retry={{
                    label: fr.chat.retry,
                    onClick: () => activeSpaceId && refreshChannels(activeSpaceId),
                  }}
                />
              ) : channels.length === 0 ? (
                <EmptyState icon={MessageSquare} message={fr.spaces.noChannels} />
              ) : !activeChannelId ? (
                <EmptyState icon={MessageSquare} message={fr.chat.noChannelSelected} />
              ) : loading ? (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-12 w-1/2" />
                  <Skeleton className="h-12 w-3/4" />
                </div>
              ) : messagesError ? (
                <ErrorState
                  message={fr.chat.loadingMessagesError}
                  retry={{ label: fr.chat.retry, onClick: reloadMessages }}
                />
              ) : messages.length === 0 && outgoing.length === 0 ? (
                <EmptyState icon={MessageSquare} message={fr.chat.noMessages} />
              ) : (
                <div className="flex flex-col gap-4">
                  {loadingOlder ? (
                    <div className="flex flex-col gap-4" aria-hidden="true">
                      <Skeleton className="h-12 w-2/3" />
                      <Skeleton className="h-12 w-1/2" />
                    </div>
                  ) : olderError ? (
                    <ErrorState
                      message={fr.chat.loadOlderError}
                      retry={{ label: fr.chat.retry, onClick: requestOlderFromButton }}
                    />
                  ) : hasOlder ? (
                    <Button
                      variant="ghost"
                      onClick={requestOlderFromButton}
                      className="self-center"
                    >
                      {fr.chat.loadOlder}
                    </Button>
                  ) : (
                    activeChannelName && (
                      <p className="text-center text-xs text-subtle">
                        {fr.chat.channelStart(activeChannelName)}
                      </p>
                    )
                  )}
                  {timeline.map((item) => {
                    if (item.type === "unread") {
                      return (
                        <div
                          key={item.key}
                          {...{ [UNREAD_SEPARATOR_ATTRIBUTE]: "" }}
                          role="separator"
                          aria-label={fr.chat.newMessages}
                          className="flex items-center gap-3 text-xs font-semibold"
                        >
                          <span className="h-px flex-1 bg-primary" aria-hidden="true" />
                          {/* --link plutôt que --primary : même teinte en clair, plus
                              claire en sombre où --primary n'atteint pas 4,5:1 sur --bg. */}
                          <span className="text-link" aria-hidden="true">
                            {fr.chat.newMessages}
                          </span>
                          <span className="h-px flex-1 bg-primary" aria-hidden="true" />
                        </div>
                      );
                    }
                    if (item.type === "day") {
                      return (
                        <div
                          key={item.key}
                          role="separator"
                          aria-label={item.label}
                          className="flex items-center gap-3 text-xs font-medium text-subtle"
                        >
                          <span className="h-px flex-1 bg-border" aria-hidden="true" />
                          <span aria-hidden="true">{item.label}</span>
                          <span className="h-px flex-1 bg-border" aria-hidden="true" />
                        </div>
                      );
                    }
                    const { group } = item;
                    return group.authorHandle === KEMET_HANDLE ? (
                      <AssistantMessage
                        key={group.messages[0]!.id}
                        content={
                          group.messages[0]!.deletedAt ? (
                            fr.chat.messageDeleted
                          ) : (
                            <RichText source={group.messages[0]!.body} />
                          )
                        }
                        skill={
                          assistantMetaByMessageId[group.messages[0]!.id]?.skill
                            ? {
                                skillName:
                                  assistantMetaByMessageId[group.messages[0]!.id]!.skill!.name,
                                skillHref: `/skills/${assistantMetaByMessageId[group.messages[0]!.id]!.skill!.slug}`,
                                authorName:
                                  assistantMetaByMessageId[group.messages[0]!.id]!.skill!
                                    .authorDisplayName,
                                authorHref: `/u/${assistantMetaByMessageId[group.messages[0]!.id]!.skill!.authorHandle}`,
                              }
                            : undefined
                        }
                        initialFeedback={
                          assistantMetaByMessageId[group.messages[0]!.id]?.helpful === true
                            ? "helpful"
                            : assistantMetaByMessageId[group.messages[0]!.id]?.helpful === false
                              ? "not-helpful"
                              : null
                        }
                        recorded={assistantMetaByMessageId[group.messages[0]!.id]?.recorded}
                        // Un visiteur ou un compte suspendu lit la réponse sans pouvoir la noter.
                        hideFeedback={!canWrite}
                        onFeedback={(helpful) =>
                          void giveAssistantFeedback(group.messages[0]!.id, helpful)
                        }
                      />
                    ) : (
                      <div key={group.messages[0]!.id} className="flex flex-col gap-1">
                        {group.messages.map((message, index) => (
                          <div
                            key={message.id}
                            {...(canWrite ? bindLongPress(message.id) : {})}
                            onClick={(event) => {
                              if (
                                (event.target as HTMLElement).closest("a, button, input, textarea")
                              )
                                return;
                              setSelectedMessageId((current) =>
                                current === message.id ? null : message.id,
                              );
                            }}
                            className={cn(
                              // Sur écran tactile, l'appui long ouvre les actions : la sélection
                              // native du texte le gênerait, « Copier le texte » la remplace.
                              "group/message relative -mx-2 flex gap-3 rounded-control px-2 py-0.5 lg:hover:bg-surface-2",
                              canWrite && "[@media(pointer:coarse)]:select-none",
                              actionsMessageId === message.id && "bg-surface-2",
                              selectedMessageId === message.id && "bg-surface-2",
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
                                  <a href={`/u/${group.authorHandle}`} className="min-w-0 max-w-full hover:underline">
                                    <UserName name={group.authorDisplayName} level={group.authorLevel} />
                                  </a>
                                  <span className="text-xs text-subtle">
                                    {formatTime(message.createdAt)}
                                  </span>
                                </div>
                              )}
                              {message.body &&
                                (message.deletedAt ? (
                                  <p className="mt-0.5 text-base text-text">
                                    {fr.chat.messageDeleted}
                                  </p>
                                ) : (
                                  <RichText
                                    source={message.body}
                                    className="mt-0.5 text-base text-text"
                                    suffix={
                                      message.editedAt && (
                                        <span className="text-xs text-subtle">
                                          ({fr.chat.edited})
                                        </span>
                                      )
                                    }
                                  />
                                ))}
                              {!message.deletedAt && message.attachments.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {message.attachments.map((attachment) =>
                                    attachment.kind === "image" ? (
                                      <img
                                        key={attachment.id}
                                        src={attachmentUrl(attachment.id)}
                                        alt={attachment.originalName}
                                        className="max-h-64 max-w-full rounded-card border border-border object-contain sm:max-w-xs"
                                      />
                                    ) : (
                                      <a
                                        key={attachment.id}
                                        href={attachmentUrl(attachment.id)}
                                        aria-label={fr.chat.downloadFile(attachment.originalName)}
                                        className="inline-flex h-control-mobile items-center gap-2 rounded-card border border-border px-3 text-sm text-text hover:bg-surface-2 md:h-control"
                                      >
                                        <Download className="size-4" aria-hidden="true" />
                                        {attachment.originalName}
                                      </a>
                                    ),
                                  )}
                                </div>
                              )}
                              {message.reactions.length > 0 && (
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                  {message.reactions.map((reaction) => {
                                    const names = reaction.profileIds
                                      .map((profileId) => memberNameById.get(profileId))
                                      .filter((name): name is string => Boolean(name));
                                    // Une liste tronquée (un des réacteurs pas encore chargé dans le
                                    // panneau des membres) induirait en erreur : on ne l'affiche que
                                    // si elle est complète, sinon on retombe sur le simple compte.
                                    const tooltipLabel =
                                      names.length === reaction.profileIds.length
                                        ? names.join(", ")
                                        : fr.chat.reactionLabel(
                                            reaction.emoji,
                                            reaction.profileIds.length,
                                          );
                                    return canWrite ? (
                                      <Tooltip key={reaction.emoji} label={tooltipLabel}>
                                        <button
                                          type="button"
                                          onClick={() => react(message.id, reaction.emoji)}
                                          aria-label={fr.chat.reactionLabel(
                                            reaction.emoji,
                                            reaction.profileIds.length,
                                          )}
                                          className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs hover:bg-accent-soft max-md:min-h-11 max-md:px-3"
                                        >
                                          {reaction.emoji} {reaction.profileIds.length}
                                        </button>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip key={reaction.emoji} label={tooltipLabel}>
                                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle">
                                          {reaction.emoji} {reaction.profileIds.length}
                                        </span>
                                      </Tooltip>
                                    );
                                  })}
                                </div>
                              )}
                              {message.replyCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openThread(message.id)}
                                  className="mt-1 inline-flex min-h-8 items-center text-xs font-medium text-link hover:underline max-md:min-h-11"
                                >
                                  {fr.chat.replyCount(message.replyCount)}
                                </button>
                              )}
                            </div>
                            {canWrite && (
                              // Actions hors du flux du texte : au survol et au focus sur
                              // bureau, à l'appui sur écran tactile.
                              <div
                                role="toolbar"
                                aria-label={fr.chat.messageActions}
                                className={cn(
                                  "pointer-events-none absolute -top-3 right-2 flex items-center gap-0.5 rounded-control border border-border bg-surface p-0.5 opacity-0 transition-opacity duration-150",
                                  "focus-within:pointer-events-auto focus-within:opacity-100 group-hover/message:pointer-events-auto group-hover/message:opacity-100",
                                  selectedMessageId === message.id &&
                                    "pointer-events-auto opacity-100",
                                )}
                              >
                                <IconButton
                                  aria-label={fr.chat.addReaction}
                                  onClick={() => react(message.id, "👍")}
                                >
                                  <SmilePlus className="size-4" aria-hidden="true" />
                                </IconButton>
                                {!message.deletedAt && (
                                  <IconButton
                                    aria-label={fr.chat.replyInThread}
                                    onClick={() => openThread(message.id)}
                                  >
                                    <MessageSquareReply className="size-4" aria-hidden="true" />
                                  </IconButton>
                                )}
                                {!message.deletedAt &&
                                  profile &&
                                  profile.id !== message.authorId && (
                                    <ReportMenu
                                      contentType="message"
                                      contentId={message.id}
                                      authorId={message.authorId}
                                      authorHandle={message.authorHandle}
                                    />
                                  )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {outgoing.length > 0 && profile && (
                    <OutgoingMessages
                      messages={outgoing}
                      authorDisplayName={profile.displayName}
                      onRetry={retry}
                      onDiscard={discard}
                    />
                  )}
                  {assistantStream && (
                    // aria-busy : la réponse arrive morceau par morceau, les lecteurs
                    // d'écran attendent le message final au lieu de lire chaque morceau.
                    <div aria-busy="true">
                      <AssistantMessage
                        content={
                          assistantStream.text ? <RichText source={assistantStream.text} /> : "…"
                        }
                        hideFeedback
                        recorded={assistantStream.recorded}
                        readSummary={
                          assistantStream.failed ? fr.chat.assistantUnavailable : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <p role="status" className="sr-only">
              {loadingOlder ? fr.chat.loadingOlder : ""}
            </p>
            {newMessagesBelow > 0 && (
              <Button
                variant="secondary"
                onClick={(event) => {
                  jumpToLatest();
                  // Le bouton disparaît : le focus irait sinon sur le document.
                  // Au toucher, le composeur ouvrirait le clavier virtuel par-dessus
                  // les messages qu'on vient d'atteindre (detail vaut 0 au clavier).
                  if (canWrite && event.detail === 0) composerRef.current?.focus();
                  else messageListRef.current?.focus();
                }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-surface shadow-floating"
              >
                <ArrowDown className="size-4" aria-hidden="true" />
                {fr.chat.jumpToLatest}
              </Button>
            )}
          </div>
          {status === "visitor" && (
            <div className="shrink-0 border-t border-border p-3">
              <VisitorBanner />
            </div>
          )}
          {isSuspended && (
            <div className="shrink-0 border-t border-border p-3">
              <SuspendedBanner />
            </div>
          )}
          {canWrite && (
            <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map((attachment) => (
                    <span
                      key={attachment.id}
                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 pl-2 text-xs text-text"
                    >
                      {attachment.originalName}
                      <IconButton
                        aria-label={fr.chat.removeAttachment(attachment.originalName)}
                        onClick={() => removePendingAttachment(attachment.id)}
                        className="size-control-compact max-md:size-control-mobile"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative flex gap-2">
                <p className="sr-only" aria-live="polite">
                  {mentions.suggestions.length > 0
                    ? fr.chat.mentionCount(mentions.suggestions.length)
                    : ""}
                </p>
                {mentions.suggestions.length > 0 && (
                  <MentionSuggestions
                    suggestions={mentions.suggestions}
                    activeIndex={mentions.activeIndex}
                    label={fr.chat.mentionSuggestions}
                    onSelect={mentions.select}
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <IconButton
                  aria-label={fr.chat.attachFile}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!activeChannelId}
                  loading={uploadingAttachment}
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                </IconButton>
                <Textarea
                  ref={composerRef}
                  placeholder={fr.chat.composerPlaceholder}
                  aria-label={fr.chat.composerPlaceholder}
                  aria-describedby={showAssistantNotice ? "assistant-notice" : undefined}
                  value={draft}
                  disabled={!activeChannelId}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    mentions.syncCaret();
                  }}
                  onSelect={mentions.syncCaret}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={mentions.suggestions.length > 0}
                  aria-controls={mentions.suggestions.length > 0 ? MENTION_LISTBOX_ID : undefined}
                  aria-activedescendant={
                    mentions.suggestions.length > 0
                      ? mentionOptionId(mentions.activeIndex)
                      : undefined
                  }
                  enterKeyHint={enterSends ? "send" : "enter"}
                  onKeyDown={(event) => {
                    if (mentions.handleKeyDown(event)) return;
                    if (
                      enterSends &&
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  variant="composer"
                  className="max-md:min-h-11 flex-1 rounded-card"
                />
                <Button
                  onClick={handleSend}
                  // Garde le focus (et le clavier mobile ouvert) dans le composeur.
                  onPointerDown={(event) => event.preventDefault()}
                  aria-label={fr.chat.send}
                  disabled={!activeChannelId || uploadingAttachment}
                  className="max-md:size-control-mobile max-md:px-0"
                >
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              </div>
              {showAssistantNotice && (
                <p id="assistant-notice" className="text-xs text-subtle">
                  {fr.assistantNotice.text}{" "}
                  <a href="/confidentialite" className="text-link hover:underline">
                    {fr.assistantNotice.link}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
        {threadParent &&
          (isDesktop ? (
            <div
              onKeyDown={(event) => {
                if (event.key === "Escape") closeThread();
              }}
              className="fixed inset-y-0 right-0 z-30 flex w-panel flex-col border-l border-border bg-surface"
            >
              {threadView}
            </div>
          ) : (
            // Plein écran sur mobile : une vraie fenêtre modale, qui garde le
            // focus et masque le salon aux lecteurs d'écran.
            <RadixDialog.Root open onOpenChange={(open) => !open && closeThread()}>
              <RadixDialog.Portal>
                <RadixDialog.Content
                  aria-describedby={undefined}
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                  className="fixed inset-0 z-50 flex flex-col bg-bg pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
                >
                  <RadixDialog.Title className="sr-only">{fr.chat.thread}</RadixDialog.Title>
                  {threadView}
                </RadixDialog.Content>
              </RadixDialog.Portal>
            </RadixDialog.Root>
          ))}
        {actionsMessage && (
          <MessageActionsSheet
            open
            onOpenChange={(open) => !open && setActionsMessageId(null)}
            onReact={() => void react(actionsMessage.id, "👍")}
            onReplyInThread={
              actionsMessage.deletedAt ? undefined : () => openThread(actionsMessage.id)
            }
            onCopy={
              actionsMessage.body && !actionsMessage.deletedAt
                ? () => void copyMessage(actionsMessage.body)
                : undefined
            }
            onReport={
              profile && !actionsMessage.deletedAt && profile.id !== actionsMessage.authorId
                ? () => setReportMessageId(actionsMessage.id)
                : undefined
            }
          />
        )}
        {reportMessage && (
          <ReportDialog
            contentType="message"
            contentId={reportMessage.id}
            authorId={reportMessage.authorId}
            authorHandle={reportMessage.authorHandle}
            open
            onClose={() => setReportMessageId(null)}
          />
        )}
      </AppShell>
    </>
  );
}
