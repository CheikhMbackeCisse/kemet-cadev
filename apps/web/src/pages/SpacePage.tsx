import { Hash, MessageSquare, Plus, Send, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addSpaceMember,
  createInvite,
  createSpace,
  listChannels,
  listSpaceMembers,
  listSpaces,
  removeSpaceMember,
} from "../lib/chat/api.js";
import { useChannelMessages } from "../lib/chat/useChannelMessages.js";
import { AppShell } from "../components/shell/AppShell.js";
import type { ChannelItem, MobileTabItem, SpaceItem } from "../components/shell/types.js";
import { Avatar } from "../components/ui/Avatar.js";
import { Button } from "../components/ui/Button.js";
import { Dialog } from "../components/ui/Dialog.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { IconButton } from "../components/ui/IconButton.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { useToast } from "../components/ui/Toast.js";
import { UserName } from "../components/ui/UserName.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { fr } from "../i18n/fr.js";
import type { Channel, Space, SpaceMember } from "@kemet/shared";

const MOBILE_TABS: MobileTabItem[] = [{ id: "salons", label: "Salons", icon: Hash }];
const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SpacePage() {
  const toast = useToast();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);
  const [spacesError, setSpacesError] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(readParam("space"));

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(readParam("channel"));

  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [draft, setDraft] = useState("");
  const [memberHandle, setMemberHandle] = useState("");

  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceVisibility, setNewSpaceVisibility] = useState<"public" | "private">("public");

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
    if (activeSpaceId) void listSpaceMembers(activeSpaceId).then((page) => setMembers(page.items));
  }, [activeSpaceId]);

  useEffect(() => {
    if (activeSpaceId && activeChannelId) writeParams({ space: activeSpaceId, channel: activeChannelId });
  }, [activeSpaceId, activeChannelId]);

  const { messages, loading, error: messagesError, reload: reloadMessages, send, react } = useChannelMessages(activeChannelId);

  const spaceItems: SpaceItem[] = useMemo(
    () => spaces.map((space) => ({ id: space.id, name: space.name, icon: Hash })),
    [spaces],
  );

  const channelItems: ChannelItem[] = useMemo(
    () => channels.map((channel) => ({ id: channel.id, name: channel.name, unreadCount: channel.unreadCount })),
    [channels],
  );

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;

  async function handleCreateSpace() {
    if (!newSpaceName.trim()) return;
    try {
      const { space } = await createSpace({
        name: newSpaceName.trim(),
        slug: slugify(newSpaceName),
        visibility: newSpaceVisibility,
      });
      setCreateSpaceOpen(false);
      setNewSpaceName("");
      setNewSpaceVisibility("public");
      await refreshSpaces();
      setActiveSpaceId(space.id);
      setActiveChannelId(null);
    } catch {
      toast.show(fr.spaces.actionError, "danger");
    }
  }

  async function handleSend() {
    if (!draft.trim()) return;
    const body = draft.trim();
    try {
      await send(body);
      setDraft("");
    } catch {
      toast.show(fr.chat.sendError, "danger");
    }
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
        }}
        channelList={{
          spaceName: activeSpace?.name ?? "",
          channels: channelItems,
          activeChannelId: activeChannelId ?? "",
          onSelect: setActiveChannelId,
        }}
        mobileTabs={MOBILE_TABS}
        activeMobileTabId="salons"
        onSelectMobileTab={() => {}}
        topBarExtra={
          <>
            <ThemeToggle />
            <IconButton
              aria-label={fr.spaces.createTitle}
              className="lg:hidden"
              onClick={() => setCreateSpaceOpen(true)}
            >
              <Plus className="size-5" aria-hidden="true" />
            </IconButton>
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => setCreateSpaceOpen(true)}>
              {fr.spaces.createTitle}
            </Button>
          </>
        }
        rightPanel={{
          title: fr.spaces.members,
          content: (
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <div key={member.profileId} className="flex items-center justify-between gap-2">
                    <UserName name={member.displayName} />
                    <Button variant="ghost" onClick={() => handleRemoveMember(member.profileId)}>
                      {fr.spaces.removeMember}
                    </Button>
                  </div>
                ))}
              </div>
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
          ),
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
            {spacesLoading ? (
              <div className="flex flex-col gap-4">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-12 w-1/2" />
              </div>
            ) : spacesError ? (
              <ErrorState message={fr.spaces.loadingSpacesError} retry={{ label: fr.chat.retry, onClick: refreshSpaces }} />
            ) : spaces.length === 0 ? (
              <EmptyState
                icon={Hash}
                message={fr.spaces.noSpaces}
                action={{ label: fr.spaces.createTitle, onClick: () => setCreateSpaceOpen(true) }}
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
                retry={{ label: fr.chat.retry, onClick: () => activeSpaceId && refreshChannels(activeSpaceId) }}
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
              <ErrorState message={fr.chat.loadingMessagesError} retry={{ label: fr.chat.retry, onClick: reloadMessages }} />
            ) : messages.length === 0 ? (
              <EmptyState icon={MessageSquare} message={fr.chat.noMessages} />
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <Avatar name={message.authorDisplayName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <UserName name={message.authorDisplayName} />
                        <span className="text-xs text-subtle">{formatTime(message.createdAt)}</span>
                        {message.editedAt && <span className="text-xs text-subtle">({fr.chat.edited})</span>}
                      </div>
                      <p className="mt-0.5 text-base text-text">
                        {message.deletedAt ? fr.chat.messageDeleted : message.body}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {message.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            type="button"
                            onClick={() => react(message.id, reaction.emoji)}
                            aria-label={fr.chat.reactionLabel(reaction.emoji, reaction.profileIds.length)}
                            className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-surface-2"
                          >
                            {reaction.emoji} {reaction.profileIds.length}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => react(message.id, "👍")}
                          aria-label={fr.chat.addReaction}
                          className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-subtle hover:bg-surface-2"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2 border-t border-border p-3">
            <Input
              placeholder={fr.chat.composerPlaceholder}
              aria-label={fr.chat.composerPlaceholder}
              value={draft}
              disabled={!activeChannelId}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSend();
              }}
            />
            <Button onClick={handleSend} aria-label={fr.chat.send} disabled={!activeChannelId}>
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </AppShell>

      <Dialog open={createSpaceOpen} onOpenChange={setCreateSpaceOpen} title={fr.spaces.createTitle}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.spaces.nameLabel}
            <Input value={newSpaceName} onChange={(event) => setNewSpaceName(event.target.value)} autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-2">
            {fr.spaces.visibilityLabel}
            <Select
              aria-label={fr.spaces.visibilityLabel}
              value={newSpaceVisibility}
              onValueChange={(value) => setNewSpaceVisibility(value as "public" | "private")}
              options={[
                { value: "public", label: fr.spaces.visibilityPublic },
                { value: "private", label: fr.spaces.visibilityPrivate },
              ]}
            />
          </label>
          <Button onClick={handleCreateSpace} disabled={!newSpaceName.trim()}>
            {fr.spaces.create}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
