import { Search } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { SEARCH_QUERY_MAX_LENGTH, type Space } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { useDebounced } from "../../lib/useDebounced.js";
import { useSession } from "../../session/SessionProvider.js";
import { SalonsSegment } from "../shell/SalonsSegment.js";
import { IconButton } from "../ui/IconButton.js";
import { SearchField } from "../ui/SearchField.js";
import { ChatSearchResults, type ChatSearchLayout } from "./ChatSearchResults.js";

export interface ChatSearchProps {
  /** "panel" : en tête du panneau du bureau ; "page" : onglets du téléphone et loupe. */
  layout: ChatSearchLayout;
  /** Onglet ouvert sur téléphone, sous la loupe. */
  section: "salons" | "messages";
  /** Ouvre un espace trouvé. Par défaut, mène à l'espace dans Salons. */
  onOpenSpace?: (space: Space) => void;
  /** Titre de la ligne du haut pour un visiteur, qui n'a pas d'onglet Messages. */
  visitorTitle?: string;
  /** La liste ordinaire, montrée tant que le champ est vide. */
  children: ReactNode;
}

function openSpaceInSalons(space: Space) {
  navigate(`/salons?space=${encodeURIComponent(space.id)}`);
}

/**
 * Une seule recherche pour Salons et Messages : les espaces publics et les
 * personnes, groupés. Sur le bureau, un champ en tête du panneau ; sur
 * téléphone, une loupe à droite des onglets qui déploie le champ par-dessus.
 * Les résultats remplacent la liste le temps de la recherche.
 */
export function ChatSearch({
  layout,
  section,
  onOpenSpace = openSpaceInSalons,
  visitorTitle,
  children,
}: ChatSearchProps) {
  const { status } = useSession();
  const signedIn = status === "ready";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const trimmed = useDebounced(query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH));
  const searching = query.trim().length > 0;
  const label = signedIn ? fr.chatSearch.label : fr.chatSearch.visitorLabel;

  function openSearch() {
    // Le focus dans le même geste que le toucher : sans lui, Safari n'ouvre
    // pas le clavier.
    flushSync(() => setOpen(true));
    inputRef.current?.focus();
  }

  function closeSearch() {
    setQuery("");
    setOpen(false);
    openButtonRef.current?.focus();
  }

  const results = (
    <ChatSearchResults
      query={trimmed}
      layout={layout}
      signedIn={signedIn}
      onOpenSpace={(space) => {
        setQuery("");
        setOpen(false);
        onOpenSpace(space);
      }}
    />
  );

  if (layout === "panel") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <SearchField
          label={label}
          placeholder={label}
          value={query}
          onChange={setQuery}
          className="mx-2 mb-1 mt-3 shrink-0"
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {searching ? results : children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex h-control-mobile shrink-0 items-stretch border-b border-border">
        <div className="min-w-0 flex-1">
          {signedIn ? (
            <SalonsSegment active={section} />
          ) : (
            <h1 className="flex h-full items-center px-4 text-md font-semibold text-text">
              {visitorTitle}
            </h1>
          )}
        </div>
        <IconButton
          ref={openButtonRef}
          aria-label={fr.chatSearch.open}
          aria-expanded={open}
          onClick={openSearch}
          className="mr-1 shrink-0"
        >
          <Search className="size-5" aria-hidden="true" />
        </IconButton>
        {open && (
          <div className="chat-search-reveal absolute inset-x-0 -bottom-px top-0 z-10 flex items-center gap-1 border-b border-border bg-bg pl-3 pr-1">
            <SearchField
              label={label}
              placeholder={label}
              value={query}
              onChange={setQuery}
              inputRef={inputRef}
              onEscapeEmpty={closeSearch}
              className="min-w-0 flex-1 [&_input]:h-10"
            />
            <button
              type="button"
              onClick={closeSearch}
              className="h-control-mobile shrink-0 rounded-control px-3 text-base font-medium text-link"
            >
              {fr.chatSearch.close}
            </button>
          </div>
        )}
      </div>
      {searching ? results : children}
    </div>
  );
}
