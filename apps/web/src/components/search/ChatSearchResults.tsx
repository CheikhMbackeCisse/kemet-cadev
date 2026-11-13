import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ProfileSummary, Space } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import {
  ChatApiError,
  joinSpace,
  openConversation,
  searchPeople,
  searchSpaces,
} from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { Avatar } from "../ui/Avatar.js";
import { Button } from "../ui/Button.js";
import { Skeleton } from "../ui/Skeleton.js";
import { SpaceIcon, spaceTints } from "../ui/SpaceIcon.js";
import { useToast } from "../ui/Toast.js";
import { UserName } from "../ui/UserName.js";

export type ChatSearchLayout = "panel" | "page";

export interface ChatSearchResultsProps {
  query: string;
  layout: ChatSearchLayout;
  /** Faux pour un visiteur : "Rejoindre" mène à la connexion, pas de personnes. */
  signedIn: boolean;
  /** Ouvre l'espace touché, rejoint ou non ; le rôle tient compte d'un "Rejoindre". */
  onOpenSpace: (space: Space) => void;
}

/**
 * Résultats groupés, espaces puis personnes. Le serveur ne renvoie que des
 * espaces publics (les miens d'abord) et des personnes joignables (celles
 * que je suis d'abord) : ni figurant, ni compte système, ni blocage.
 */
export function ChatSearchResults({
  query,
  layout,
  signedIn,
  onOpenSpace,
}: ChatSearchResultsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
      <SpaceResults query={query} layout={layout} canJoin={signedIn} onOpen={onOpenSpace} />
      {signedIn && <PeopleResults query={query} layout={layout} />}
    </div>
  );
}

function Group({
  title,
  layout,
  children,
}: {
  title: string;
  layout: ChatSearchLayout;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="pb-2">
      <h3
        className={cn(
          "pb-1 pt-2 text-sm font-semibold text-text",
          layout === "panel" ? "px-3" : "px-4",
        )}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function GroupState({
  layout,
  status,
  emptyMessage,
  errorMessage,
  onRetry,
}: {
  layout: ChatSearchLayout;
  status: "loading" | "error" | "empty";
  emptyMessage: string;
  errorMessage: string;
  onRetry: () => void;
}) {
  const padding = layout === "panel" ? "px-3" : "px-4";
  if (status === "loading") {
    return (
      <div className={cn("flex flex-col gap-2 py-1", padding)} aria-busy="true">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={cn("flex flex-col items-start gap-1 py-1", padding)}>
        <p className="text-sm text-muted">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-control text-sm font-medium text-link hover:underline"
        >
          {fr.chat.retry}
        </button>
      </div>
    );
  }
  return (
    <p role="status" className={cn("py-1 text-sm text-muted", padding)}>
      {emptyMessage}
    </p>
  );
}

function SpaceResults({
  query,
  layout,
  canJoin,
  onOpen,
}: {
  query: string;
  layout: ChatSearchLayout;
  canJoin: boolean;
  onOpen: (space: Space) => void;
}) {
  const toast = useToast();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ["space-search", query],
    queryFn: () => searchSpaces(query),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  async function join(space: Space) {
    if (!canJoin) {
      navigate("/connexion");
      return;
    }
    setJoiningId(space.id);
    try {
      await joinSpace(space.id);
      onOpen({ ...space, role: "member", memberCount: space.memberCount + 1 });
    } catch {
      toast.show(fr.spaces.joinError, "danger");
    } finally {
      setJoiningId(null);
    }
  }

  const spaces = results.data?.items;
  const padding = layout === "panel" ? "px-2" : "px-4";
  const tints = spaceTints(spaces ?? []);

  return (
    <Group title={fr.chatSearch.spacesGroup} layout={layout}>
      {results.isError || !spaces || spaces.length === 0 ? (
        <GroupState
          layout={layout}
          status={results.isError ? "error" : !spaces ? "loading" : "empty"}
          emptyMessage={fr.spaces.searchEmpty(query)}
          errorMessage={fr.spaces.searchError}
          onRetry={() => void results.refetch()}
        />
      ) : (
        <ul aria-label={fr.spaces.searchResults} className="flex flex-col">
          {spaces.map((space) => (
            <li key={space.id} className={cn("flex items-center gap-2", padding)}>
              <button
                type="button"
                onClick={() => onOpen(space)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-1 py-2 text-left hover:bg-surface-2"
              >
                <SpaceIcon
                  id={space.id}
                  name={space.name}
                  tint={tints.get(space.id)}
                  className={
                    layout === "panel" ? "size-8 rounded-[6px]" : "size-10 rounded-control"
                  }
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-text">{space.name}</span>
                  <span className="truncate text-xs text-muted">
                    {space.description
                      ? `${fr.spaces.memberCount(space.memberCount)} · ${space.description}`
                      : fr.spaces.memberCount(space.memberCount)}
                  </span>
                </span>
              </button>
              {space.role ? (
                <span className="shrink-0 text-xs text-subtle">{fr.spaces.joined}</span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  aria-label={
                    canJoin
                      ? fr.spaces.joinLabel(space.name)
                      : fr.chatSearch.signInToJoin(space.name)
                  }
                  loading={joiningId === space.id}
                  onClick={() => void join(space)}
                  // 32 px à l'œil, 44 px au doigt.
                  className="relative h-8 shrink-0 px-3 text-[13px] after:absolute after:inset-x-0 after:-inset-y-1.5 max-md:h-8"
                >
                  {fr.spaces.join}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Group>
  );
}

function PeopleResults({ query, layout }: { query: string; layout: ChatSearchLayout }) {
  const toast = useToast();
  const [openingHandle, setOpeningHandle] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ["people-search", query],
    queryFn: () => searchPeople(query),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });

  async function write(person: ProfileSummary) {
    setOpeningHandle(person.handle);
    try {
      const { conversation } = await openConversation([person.handle]);
      navigate(`/messages/${conversation.id}`);
    } catch (error) {
      // Le serveur dit pourquoi (blocage, demande déjà envoyée) : son message est le plus utile.
      toast.show(
        error instanceof ChatApiError && error.statusCode < 500
          ? error.message
          : fr.messages.writeError,
        "danger",
      );
    } finally {
      setOpeningHandle(null);
    }
  }

  const people = results.data?.items;
  return (
    <Group title={fr.chatSearch.peopleGroup} layout={layout}>
      {results.isError || !people || people.length === 0 ? (
        <GroupState
          layout={layout}
          status={results.isError ? "error" : !people ? "loading" : "empty"}
          emptyMessage={fr.messages.searchEmpty(query)}
          errorMessage={fr.messages.searchError}
          onRetry={() => void results.refetch()}
        />
      ) : (
        <ul
          aria-label={fr.messages.searchResults}
          className={cn("flex flex-col", layout === "panel" ? "px-2" : "px-4")}
        >
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                aria-label={fr.messages.writeTo(person.displayName)}
                aria-busy={openingHandle === person.handle || undefined}
                disabled={openingHandle !== null}
                onClick={() => void write(person)}
                className="flex w-full items-center gap-3 rounded-control px-1 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
              >
                <Avatar
                  name={person.displayName}
                  src={person.avatarUrl ?? undefined}
                  size={layout === "panel" ? 32 : 40}
                  countryCode={person.country}
                />
                <span className="flex min-w-0 flex-col">
                  <UserName name={person.displayName} className="truncate text-sm font-medium" />
                  <span className="truncate text-xs text-subtle">@{person.handle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Group>
  );
}
