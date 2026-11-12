import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SEARCH_QUERY_MAX_LENGTH, type Space } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { joinSpace, searchSpaces } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { useDebounced } from "../../lib/useDebounced.js";
import { Button } from "../ui/Button.js";
import { SearchField } from "../ui/SearchField.js";
import { Skeleton } from "../ui/Skeleton.js";
import { SpaceIcon, spaceTints } from "../ui/SpaceIcon.js";
import { useToast } from "../ui/Toast.js";

export interface SpaceSearchProps {
  /** Faux pour un visiteur : "Rejoindre" mène à la connexion. */
  canJoin: boolean;
  /** Ouvre l'espace touché, rejoint ou non ; le rôle tient compte d'un "Rejoindre". */
  onOpen: (space: Space) => void;
  /** "panel" : colonne étroite du bureau ; "page" : pleine largeur sur téléphone. */
  layout: "panel" | "page";
  /** La liste ordinaire, montrée tant que le champ est vide. */
  children: ReactNode;
}

/**
 * Recherche dans les espaces publics, en tête de la liste des espaces. Les
 * résultats remplacent la liste le temps de la recherche.
 */
export function SpaceSearch({ canJoin, onOpen, layout, children }: SpaceSearchProps) {
  const [query, setQuery] = useState("");
  const trimmed = useDebounced(query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH));
  const searching = query.trim().length > 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", layout === "panel" && "pt-3")}>
      <SearchField
        label={fr.spaces.searchLabel}
        placeholder={fr.spaces.searchPlaceholder}
        value={query}
        onChange={setQuery}
        className={cn("shrink-0", layout === "panel" ? "mx-2" : "mx-4 my-2")}
      />
      {searching ? (
        <SpaceSearchResults
          query={trimmed}
          canJoin={canJoin}
          layout={layout}
          onOpen={(space) => {
            setQuery("");
            onOpen(space);
          }}
        />
      ) : (
        children
      )}
    </div>
  );
}

function SpaceSearchResults({
  query,
  canJoin,
  layout,
  onOpen,
}: {
  query: string;
  canJoin: boolean;
  layout: SpaceSearchProps["layout"];
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

  const padding = layout === "panel" ? "px-2" : "px-4";
  if (results.isError) {
    return (
      <div className={cn("flex flex-col items-start gap-1 py-3", padding)}>
        <p className="text-sm text-muted">{fr.spaces.searchError}</p>
        <button
          type="button"
          onClick={() => void results.refetch()}
          className="rounded-control text-sm font-medium text-link hover:underline"
        >
          {fr.chat.retry}
        </button>
      </div>
    );
  }
  if (!results.data) {
    return (
      <div className={cn("flex flex-col gap-2 py-3", padding)} aria-busy="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  const spaces = results.data.items;
  if (spaces.length === 0) {
    return (
      <p role="status" className={cn("py-3 text-sm text-muted", padding)}>
        {fr.spaces.searchEmpty(query)}
      </p>
    );
  }
  const tints = spaceTints(spaces);

  return (
    <ul
      aria-label={fr.spaces.searchResults}
      className={cn("flex min-h-0 flex-col overflow-y-auto py-2", layout === "panel" && "px-1")}
    >
      {spaces.map((space) => (
        <li key={space.id} className={cn("flex items-center gap-2", padding)}>
          <button
            type="button"
            onClick={() => onOpen(space)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-control py-2 text-left hover:bg-surface-2"
          >
            <SpaceIcon
              id={space.id}
              name={space.name}
              tint={tints.get(space.id)}
              className={layout === "panel" ? "size-8 rounded-[6px]" : "size-10 rounded-control"}
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
              aria-label={fr.spaces.joinLabel(space.name)}
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
  );
}
