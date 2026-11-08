import { navigate } from "../lib/navigation/navigate.js";
import { BookOpen, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkSort, WorkSummary, WorkType } from "@kemet/shared";
import { listWorks } from "../lib/chat/api.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { IconButton } from "../components/ui/IconButton.js";
import { useToast } from "../components/ui/Toast.js";
import { HeaderActionLink } from "../components/ui/HeaderActionLink.js";
import { RailPage } from "../components/layout/RailPage.js";
import { WorkCard } from "../components/works/WorkCard.js";
import { WORK_TYPE_LABELS, WORK_TYPES } from "../components/works/workLabels.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const ALL = "all";

interface WorkFilters {
  q: string;
  type: WorkType | null;
  sort: WorkSort;
  tag: string;
}

// Les filtres vivent dans l'adresse : une liste filtrée se partage par un lien.
function readFilters(): WorkFilters {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  return {
    q: params.get("q") ?? "",
    type: WORK_TYPES.includes(type as WorkType) ? (type as WorkType) : null,
    sort: params.get("tri") === "discussed" ? "discussed" : "recent",
    tag: params.get("tag") ?? "",
  };
}

function writeFilters(filters: WorkFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.sort !== "recent") params.set("tri", filters.sort);
  if (filters.tag) params.set("tag", filters.tag);
  const query = params.toString();
  window.history.replaceState(null, "", `/travaux${query ? `?${query}` : ""}`);
}

function toQuery(filters: WorkFilters) {
  return {
    q: filters.q || undefined,
    type: filters.type ?? undefined,
    sort: filters.sort,
    tag: filters.tag || undefined,
  };
}

export function WorksPage() {
  const toast = useToast();
  const { status } = useSession();
  const initial = readFilters();
  const [q, setQ] = useState(initial.q);
  const [qDraft, setQDraft] = useState(initial.q);
  const [type, setType] = useState<WorkType | null>(initial.type);
  const [sort, setSort] = useState<WorkSort>(initial.sort);
  const [tag, setTag] = useState(initial.tag);
  const [tagDraft, setTagDraft] = useState(initial.tag);
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  // Une réponse lente ne doit pas écraser celle de filtres choisis après elle.
  const latestRequest = useRef(0);

  const load = useCallback(() => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(false);
    const filters = { q, type, sort, tag };
    writeFilters(filters);
    listWorks(toQuery(filters))
      .then((page) => {
        if (request !== latestRequest.current) return;
        setWorks(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (request === latestRequest.current) setError(true);
      })
      .finally(() => {
        if (request === latestRequest.current) setLoading(false);
      });
  }, [q, type, sort, tag]);

  useEffect(() => load(), [load]);

  async function loadMore() {
    if (!nextCursor) return;
    const request = latestRequest.current;
    setLoadingMore(true);
    try {
      const page = await listWorks({
        ...toQuery({ q, type, sort, tag }),
        cursor: nextCursor,
      });
      if (request !== latestRequest.current) return;
      setWorks((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.show(fr.works.loadMoreError, "danger");
    } finally {
      setLoadingMore(false);
    }
  }

  function applyTag(value: string) {
    const normalized = value.trim().toLowerCase();
    setTagDraft(normalized);
    setTag(normalized);
  }

  function submitTag(event: FormEvent) {
    event.preventDefault();
    applyTag(tagDraft);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQ(qDraft.trim());
  }

  function clearSearch() {
    setQDraft("");
    setQ("");
  }

  const filtered = q !== "" || type !== null || tag !== "";

  return (
    <RailPage activeSection="travaux" className="gap-6 px-4 pt-3 lg:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.works.title}</h1>
        {status !== "visitor" && (
          <HeaderActionLink href="/travaux/nouveau" icon={Plus}>
            {fr.works.create}
          </HeaderActionLink>
        )}
      </div>

      <form role="search" onSubmit={submitSearch} className="flex items-center gap-2">
        <label htmlFor="works-search" className="sr-only">
          {fr.works.searchLabel}
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <Input
            id="works-search"
            type="search"
            value={qDraft}
            placeholder={fr.works.searchPlaceholder}
            onChange={(event) => setQDraft(event.target.value)}
            className="pl-9"
          />
        </div>
        {q && (
          <IconButton type="button" aria-label={fr.works.clearSearch} onClick={clearSearch}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        )}
        <Button type="submit" variant="secondary">
          {fr.works.searchSubmit}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={type ?? ALL}
          onValueChange={(value) => setType(value === ALL ? null : (value as WorkType))}
          aria-label={fr.works.filterTypeLabel}
          className="w-auto min-w-36"
          options={[
            { value: ALL, label: fr.works.filterAllTypes },
            ...WORK_TYPES.map((value) => ({ value, label: WORK_TYPE_LABELS[value] })),
          ]}
        />
        <Select
          value={sort}
          onValueChange={(value) => setSort(value as WorkSort)}
          aria-label={fr.works.sortLabel}
          className="w-auto min-w-36"
          options={[
            { value: "recent", label: fr.works.sortRecent },
            { value: "discussed", label: fr.works.sortDiscussed },
          ]}
        />
        <form onSubmit={submitTag} className="flex min-w-40 flex-1 items-center gap-2 sm:max-w-64">
          <label htmlFor="works-tag-filter" className="sr-only">
            {fr.works.filterTagLabel}
          </label>
          <Input
            id="works-tag-filter"
            value={tagDraft}
            placeholder={fr.works.filterTagPlaceholder}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => tagDraft.trim().toLowerCase() !== tag && applyTag(tagDraft)}
          />
          {tag && (
            <IconButton
              type="button"
              aria-label={fr.works.clearTag(tag)}
              onClick={() => applyTag("")}
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </form>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-72 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          message={fr.works.loadingError}
          retry={{ label: fr.chat.retry, onClick: load }}
        />
      ) : works.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message={filtered ? fr.works.noWorksForFilter : fr.works.noWorks}
          action={
            filtered
              ? {
                  label: fr.works.clearFilters,
                  onClick: () => {
                    clearSearch();
                    setType(null);
                    applyTag("");
                  },
                }
              : status === "visitor"
                ? {
                    label: fr.works.signInToPublish,
                    onClick: () => navigate("/connexion"),
                  }
                : {
                    label: fr.works.createTitle,
                    onClick: () => navigate("/travaux/nouveau"),
                  }
          }
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {works.map((work) => (
              <WorkCard key={work.id} work={work} onTagClick={applyTag} />
            ))}
          </ul>
          {nextCursor && (
            <Button
              variant="secondary"
              className="self-center"
              onClick={loadMore}
              loading={loadingMore}
            >
              {fr.works.loadMore}
            </Button>
          )}
        </>
      )}
    </RailPage>
  );
}
