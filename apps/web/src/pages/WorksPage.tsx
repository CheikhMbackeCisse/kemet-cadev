import { BookOpen, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { WorkSort, WorkStatus, WorkSummary, WorkType } from "@kemet/shared";
import { listWorks } from "../lib/chat/api.js";
import { Button } from "../components/ui/Button.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ErrorState } from "../components/ui/ErrorState.js";
import { Input } from "../components/ui/Input.js";
import { Select } from "../components/ui/Select.js";
import { Skeleton } from "../components/ui/Skeleton.js";
import { IconButton } from "../components/ui/IconButton.js";
import { useToast } from "../components/ui/Toast.js";
import { RailPage } from "../components/layout/RailPage.js";
import { WorkListItem } from "../components/works/WorkListItem.js";
import {
  WORK_STATUS_LABELS,
  WORK_STATUSES,
  WORK_TYPE_LABELS,
  WORK_TYPES,
} from "../components/works/workLabels.js";
import { useSession } from "../session/SessionProvider.js";
import { fr } from "../i18n/fr.js";

const ALL = "all";

interface WorkFilters {
  q: string;
  type: WorkType | null;
  status: WorkStatus | null;
  sort: WorkSort;
  tag: string;
}

// Les filtres vivent dans l'adresse : une liste filtrée se partage par un lien.
function readFilters(): WorkFilters {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type");
  const status = params.get("statut");
  return {
    q: params.get("q") ?? "",
    type: WORK_TYPES.includes(type as WorkType) ? (type as WorkType) : null,
    status: WORK_STATUSES.includes(status as WorkStatus) ? (status as WorkStatus) : null,
    sort: params.get("tri") === "discussed" ? "discussed" : "recent",
    tag: params.get("tag") ?? "",
  };
}

function writeFilters(filters: WorkFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("statut", filters.status);
  if (filters.sort !== "recent") params.set("tri", filters.sort);
  if (filters.tag) params.set("tag", filters.tag);
  const query = params.toString();
  window.history.replaceState(null, "", `/travaux${query ? `?${query}` : ""}`);
}

function toQuery(filters: WorkFilters) {
  return {
    q: filters.q || undefined,
    type: filters.type ?? undefined,
    status: filters.status ?? undefined,
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
  const [workStatus, setWorkStatus] = useState<WorkStatus | null>(initial.status);
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
    const filters = { q, type, status: workStatus, sort, tag };
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
  }, [q, type, workStatus, sort, tag]);

  useEffect(() => load(), [load]);

  async function loadMore() {
    if (!nextCursor) return;
    const request = latestRequest.current;
    setLoadingMore(true);
    try {
      const page = await listWorks({
        ...toQuery({ q, type, status: workStatus, sort, tag }),
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

  const filtered = q !== "" || type !== null || workStatus !== null || tag !== "";

  return (
    <RailPage activeSection="travaux" className="gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3">
        <h1 className="text-lg font-bold text-text">{fr.works.title}</h1>
        {status !== "visitor" && (
          <a
            href="/travaux/nouveau"
            className="inline-flex h-control max-md:h-control-mobile shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" />
            {fr.works.create}
          </a>
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

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm text-text-2 sm:w-48">
          {fr.works.filterTypeLabel}
          <Select
            value={type ?? ALL}
            onValueChange={(value) => setType(value === ALL ? null : (value as WorkType))}
            aria-label={fr.works.filterTypeLabel}
            options={[
              { value: ALL, label: fr.works.filterAllTypes },
              ...WORK_TYPES.map((value) => ({ value, label: WORK_TYPE_LABELS[value] })),
            ]}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2 sm:w-36">
          {fr.works.filterStatusLabel}
          <Select
            value={workStatus ?? ALL}
            onValueChange={(value) => setWorkStatus(value === ALL ? null : (value as WorkStatus))}
            aria-label={fr.works.filterStatusLabel}
            options={[
              { value: ALL, label: fr.works.filterAllStatuses },
              ...WORK_STATUSES.map((value) => ({ value, label: WORK_STATUS_LABELS[value] })),
            ]}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-2 sm:w-44">
          {fr.works.sortLabel}
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as WorkSort)}
            aria-label={fr.works.sortLabel}
            options={[
              { value: "recent", label: fr.works.sortRecent },
              { value: "discussed", label: fr.works.sortDiscussed },
            ]}
          />
        </label>
        <form onSubmit={submitTag} className="flex flex-1 flex-col gap-1 text-sm text-text-2">
          <label htmlFor="works-tag-filter">{fr.works.filterTagLabel}</label>
          <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
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
                    setWorkStatus(null);
                    applyTag("");
                  },
                }
              : status === "visitor"
                ? {
                    label: fr.works.signInToPublish,
                    onClick: () => (window.location.href = "/connexion"),
                  }
                : {
                    label: fr.works.createTitle,
                    onClick: () => (window.location.href = "/travaux/nouveau"),
                  }
          }
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {works.map((work) => (
              <WorkListItem key={work.id} work={work} onTagClick={applyTag} />
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
