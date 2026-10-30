import {
  Download,
  Hash,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Star,
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
import { AssistantMessage } from "../components/assistant/AssistantMessage.js";
import { RichText } from "../components/content/RichText.js";
import { AccountMenu } from "../components/shell/AccountMenu.js";
import { AppShell } from "../components/shell/AppShell.js";
import { VisitorBanner } from "../components/shell/VisitorBanner.js";
import { SuspendedBanner } from "../components/shell/SuspendedBanner.js";
import { MOBILE_TABS, mobileTabHref } from "../components/shell/mobileTabs.js";
import { ReportMenu } from "../components/moderation/ReportMenu.js";
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
import { Tooltip } from "../components/ui/Tooltip.js";
import { useToast } from "../components/ui/Toast.js";
import { UserName } from "../components/ui/UserName.js";
import { formatCount } from "../lib/formatCount.js";
import { fr } from "../i18n/fr.js";
import {
  KEMET_HANDLE,
  type Attachment,
  type Channel,
  type Message,
  type Space,
  type SpaceMember,
} from "@kemet/shared";

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;
interface MessageGroup {
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorCountry: string | null;
  messages: Message[];
}

/** Regroupe les messages consécutifs d'une même personne sous un seul avatar (DESIGN.md, « Message »). */
function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];
    const withinWindow = lastMessage
      ? new Date(message.createdAt).getTime() - new Date(lastMessage.createdAt).getTime() <
        MESSAGE_GROUP_WINDOW_MS
      : false;
    const assistantInvolved =
      message.authorHandle === KEMET_HANDLE || last?.authorHandle === KEMET_HANDLE;
    if (last && last.authorId === message.authorId && withinWindow && !assistantInvolved) {
      last.messages.push(message);
    } else {
      groups.push({
        authorId: message.authorId,
        authorHandle: message.authorHandle,
        authorDisplayName: message.authorDisplayName,
        authorAvatarUrl: message.authorAvatarUrl,
        authorCountry: message.authorCountry,
        messages: [message],
      });
    }
  }
  return groups;
}

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
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [memberHandle, setMemberHandle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function switchChannel(channelId: string) {
    // Une pièce jointe envoyée appartient au salon où elle a été envoyée
    // (requireChannelAccess côté serveur la rejetterait dans un autre
    // salon) : elle ne doit pas survivre à un changement de salon sans
    // message envoyé. Nettoyage au clic plutôt que dans un effet réactif
    // à `activeChannelId` : cet effet se redéclenchait aussi à la
    // sélection automatique du premier salon d'un espace (refreshChannels
    // ci-dessous), effaçant un brouillon en cours de frappe si cette
    // sélection arrivait après coup.
    setDraft("");
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

  useEffect(() => {
    // Réservé aux membres connectés : un visiteur n'a pas accès à
    // GET /api/spaces/:id/members (voir apps/server/src/api/routes/spaces.ts).
    if (activeSpaceId && canInteract) {
      void listSpaceMembers(activeSpaceId).then((page) => {
        setMembers(page.items);
        setMembersNextCursor(page.nextCursor);
      });
    }
  }, [activeSpaceId, canInteract]);

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
    assistantStream,
    assistantMetaByMessageId,
    reload: reloadMessages,
    send,
    react,
    giveAssistantFeedback,
  } = useChannelMessages(activeChannelId, canInteract);

  const spaceItems: SpaceItem[] = useMemo(
    () => spaces.map((space) => ({ id: space.id, name: space.name })),
    [spaces],
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

  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
  // Le serveur refuse deja ces actions aux simples membres : la condition ne
  // fait qu'eviter de leur montrer des boutons qui echoueront.
  const canManageMembers =
    canWrite && (activeSpace?.role === "owner" || activeSpace?.role === "admin");

  async function handleSend() {
    const body = draft.trim();
    if (!body && pendingAttachments.length === 0) return;
    try {
      await send(
        body,
        null,
        pendingAttachments.map((attachment) => attachment.id),
      );
      setDraft("");
      setPendingAttachments([]);
    } catch {
      toast.show(fr.chat.sendError, "danger");
    }
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
        spaceRail={{
          spaces: spaceItems,
          activeSpaceId: activeSpaceId ?? "",
          onSelect: (id) => {
            setActiveSpaceId(id);
            setActiveChannelId(null);
          },
          activeSection: "salons",
          onCreateSpace: canWrite ? () => (window.location.href = "/salons/nouveau") : undefined,
        }}
        channelList={{
          spaceName: activeSpace
            ? `${activeSpace.name} · ${fr.spaces.memberCountBadge(formatCount(activeSpace.memberCount))}`
            : "",
          channels: channelItems,
          activeChannelId: activeChannelId ?? "",
          onSelect: switchChannel,
        }}
        mobileTabs={MOBILE_TABS}
        activeMobileTabId="salons"
        onSelectMobileTab={(id) => {
          if (id !== "salons") window.location.href = mobileTabHref(id, profile?.handle ?? null);
        }}
        topBarExtra={
          <>
            {/* La navigation entre sections vit dans le rail de gauche
                (RAIL_NAV) sur grand ecran et dans la barre d'onglets sur
                mobile. Skills n'a pas d'onglet mobile : son icone reste
                donc le seul acces a cette taille. */}
            <a
              href="/skills"
              aria-label={fr.skills.title}
              className="inline-flex size-control max-md:size-control-mobile items-center justify-center rounded-control text-text-2 transition-colors duration-150 hover:bg-surface-2 hover:text-text lg:hidden"
            >
              <Star className="size-5" aria-hidden="true" />
            </a>
            {canWrite && (
              <a
                href="/salons/nouveau"
                aria-label={fr.spaces.createTitle}
                className="inline-flex size-control max-md:size-control-mobile items-center justify-center rounded-control text-text-2 hover:bg-surface-2 hover:text-text lg:hidden"
              >
                <Plus className="size-5" aria-hidden="true" />
              </a>
            )}
            <AccountMenu />
          </>
        }
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
                      {members.length === 0 ? (
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
          <div
            role="log"
            aria-label={fr.chat.messageList}
            // Seuls les nouveaux messages sont lus : sans aria-relevant, chaque
            // réaction ajoutée serait aussi annoncée.
            aria-relevant="additions"
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
            ) : messages.length === 0 ? (
              <EmptyState icon={MessageSquare} message={fr.chat.noMessages} />
            ) : (
              <div className="flex flex-col gap-4">
                {messageGroups.map((group) =>
                  group.authorHandle === KEMET_HANDLE ? (
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
                      onFeedback={(helpful) =>
                        void giveAssistantFeedback(group.messages[0]!.id, helpful)
                      }
                    />
                  ) : (
                    <div key={group.messages[0]!.id} className="flex flex-col gap-1">
                      {group.messages.map((message, index) => (
                        <div key={message.id} className="flex gap-3">
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
                              <div className="flex items-baseline gap-2">
                                <a href={`/u/${group.authorHandle}`} className="hover:underline">
                                  <UserName name={group.authorDisplayName} />
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
                                      className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-surface-2"
                                    >
                                      {reaction.emoji} {reaction.profileIds.length}
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip key={reaction.emoji} label={tooltipLabel}>
                                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-subtle">
                                      {reaction.emoji} {reaction.profileIds.length}
                                    </span>
                                  </Tooltip>
                                );
                              })}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => react(message.id, "👍")}
                                  aria-label={fr.chat.addReaction}
                                  className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-subtle hover:bg-surface-2"
                                >
                                  <Plus className="size-4" aria-hidden="true" />
                                </button>
                              )}
                              {canWrite &&
                                !message.deletedAt &&
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
                          </div>
                        </div>
                      ))}
                    </div>
                  ),
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
                      readSummary={
                        assistantStream.failed ? fr.chat.assistantUnavailable : undefined
                      }
                    />
                  </div>
                )}
              </div>
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
                      className="inline-flex items-center gap-1 rounded-card border border-border pl-2 text-xs text-text"
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
              <div className="flex gap-2">
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
                  placeholder={fr.chat.composerPlaceholder}
                  aria-label={fr.chat.composerPlaceholder}
                  value={draft}
                  disabled={!activeChannelId}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  maxHeight={144}
                  className="min-h-9 max-md:min-h-11 flex-1 py-2"
                />
                <Button
                  onClick={handleSend}
                  aria-label={fr.chat.send}
                  disabled={!activeChannelId || uploadingAttachment}
                >
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </>
  );
}
