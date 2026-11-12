import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SEARCH_QUERY_MAX_LENGTH, type ProfileSummary } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { ChatApiError, openConversation, searchPeople } from "../../lib/chat/api.js";
import { cn } from "../../lib/cn.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { useDebounced } from "../../lib/useDebounced.js";
import { Avatar } from "../ui/Avatar.js";
import { SearchField } from "../ui/SearchField.js";
import { Skeleton } from "../ui/Skeleton.js";
import { useToast } from "../ui/Toast.js";
import { UserName } from "../ui/UserName.js";

export interface PeopleSearchProps {
  /** "panel" : colonne étroite du bureau ; "page" : pleine largeur sur téléphone. */
  layout: "panel" | "page";
  /** Les conversations, montrées tant que le champ est vide. */
  children: ReactNode;
}

/**
 * Trouver une personne par nom ou identifiant et lui écrire. Toucher un nom
 * ouvre la conversation à deux, ou la crée en demande comme "Écrire" sur un
 * profil : le serveur applique les mêmes règles.
 */
export function PeopleSearch({ layout, children }: PeopleSearchProps) {
  const [query, setQuery] = useState("");
  const trimmed = useDebounced(query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH));

  return (
    <div className="flex min-h-0 flex-col">
      <SearchField
        label={fr.messages.searchLabel}
        placeholder={fr.messages.searchPlaceholder}
        value={query}
        onChange={setQuery}
        className={cn("shrink-0", layout === "panel" ? "mx-2 mt-3" : "mx-4 my-2")}
      />
      {query.trim() ? <PeopleResults query={trimmed} layout={layout} /> : children}
    </div>
  );
}

function PeopleResults({ query, layout }: { query: string; layout: PeopleSearchProps["layout"] }) {
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

  const padding = layout === "panel" ? "px-2" : "px-4";
  if (results.isError) {
    return (
      <div className={cn("flex flex-col items-start gap-1 py-3", padding)}>
        <p className="text-sm text-muted">{fr.messages.searchError}</p>
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
  const people = results.data.items;
  if (people.length === 0) {
    return (
      <p role="status" className={cn("py-3 text-sm text-muted", padding)}>
        {fr.messages.searchEmpty(query)}
      </p>
    );
  }

  return (
    <ul aria-label={fr.messages.searchResults} className={cn("flex flex-col py-2", padding)}>
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            aria-label={fr.messages.writeTo(person.displayName)}
            aria-busy={openingHandle === person.handle || undefined}
            disabled={openingHandle !== null}
            onClick={() => void write(person)}
            className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
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
  );
}
