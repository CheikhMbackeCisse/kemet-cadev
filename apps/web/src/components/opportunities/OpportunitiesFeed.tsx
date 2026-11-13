import { Briefcase, Building2 } from "lucide-react";
import { ORGANIZATION_REQUEST_PATH } from "../../lib/navigation/paths.js";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { listOpportunities, type OpportunityFilters as ApiFilters } from "../../lib/chat/api.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import {
  ALL,
  NO_FILTERS,
  opportunityListSearch,
  readOpportunityListState,
  type OpportunityFilterValues,
  type OpportunityListState,
} from "../../lib/opportunities/listState.js";
import { SIGN_UP_PATH } from "../../session/signUpInvite.js";
import { OpportunityFilters } from "./OpportunityFilters.js";
import { OpportunityRow, OpportunityRowSkeleton } from "./OpportunityRow.js";

function toApiFilters(filters: OpportunityFilterValues, includeClosed: boolean): ApiFilters {
  return {
    kind: filters.kind === ALL ? undefined : filters.kind,
    country: filters.country === ALL ? undefined : filters.country,
    domain: filters.domain === ALL ? undefined : filters.domain,
    includeClosed,
  };
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-2 text-sm text-danger"
    >
      {message}
      <Button variant="secondary" onClick={onRetry}>
        {fr.chat.retry}
      </Button>
    </div>
  );
}

/** Onglet Opportunités du fil : les offres (emploi, stage, mission), filtrables. Les projets ont leur onglet. */
export function OpportunitiesFeed({ viewerProfileId }: { viewerProfileId: string | null }) {
  // Les filtres vivent dans l'adresse : le retour depuis une offre les retrouve.
  const [listState, setListState] = useState<OpportunityListState>(() =>
    readOpportunityListState(window.location.search),
  );
  const { filters, includeClosed } = listState;

  function changeListState(next: OpportunityListState) {
    setListState(next);
    const search = opportunityListSearch(window.location.search, next);
    window.history.replaceState(window.history.state, "", window.location.pathname + search);
  }
  const setFilters = (next: OpportunityFilterValues) =>
    changeListState({ ...listState, filters: next });
  const apiFilters = toApiFilters(filters, includeClosed);

  const offers = useInfiniteQuery({
    queryKey: ["opportunities", apiFilters],
    queryFn: ({ pageParam }) => listOpportunities(apiFilters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

  const entries = offers.data?.pages.flatMap((page) => page.items) ?? [];
  const loading = offers.isPending;
  const filtered = filters.kind !== ALL || filters.country !== ALL || filters.domain !== ALL;

  let content;
  if (loading) {
    content = (
      <div className="flex flex-col divide-y divide-border">
        <OpportunityRowSkeleton />
        <OpportunityRowSkeleton />
        <OpportunityRowSkeleton />
      </div>
    );
  } else if (offers.isError && entries.length === 0) {
    content = (
      <ErrorState
        message={fr.opportunities.loadingError}
        retry={{ label: fr.chat.retry, onClick: () => void offers.refetch() }}
      />
    );
  } else if (entries.length === 0) {
    content = (
      <EmptyState
        icon={Briefcase}
        message={
          filtered
            ? fr.opportunities.emptyFiltered
            : viewerProfileId
              ? fr.opportunities.empty
              : fr.opportunities.emptyVisitor
        }
        action={
          filtered
            ? { label: fr.opportunities.clearFilters, onClick: () => setFilters(NO_FILTERS) }
            : viewerProfileId
              ? {
                  label: fr.opportunities.publish,
                  onClick: () => navigate("/opportunites/nouvelle"),
                }
              : { label: fr.opportunities.signUpToPublish, onClick: () => navigate(SIGN_UP_PATH) }
        }
      />
    );
  } else {
    content = (
      <ul className="flex flex-col divide-y divide-border">
        {entries.map((offer) => (
          <OpportunityRow key={offer.id} opportunity={offer} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <OpportunityFilters value={filters} onChange={setFilters} />
      {!loading && entries.length > 0 && offers.isError && !offers.isFetchNextPageError && (
        <InlineError message={fr.opportunities.offersError} onRetry={() => void offers.refetch()} />
      )}
      {content}
      {offers.isFetchNextPageError && (
        <InlineError
          message={fr.opportunities.moreError}
          onRetry={() => void offers.fetchNextPage()}
        />
      )}
      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {offers.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => void offers.fetchNextPage()}
              disabled={offers.isFetchingNextPage}
            >
              {fr.opportunities.loadMore}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => changeListState({ ...listState, includeClosed: !includeClosed })}
          >
            {includeClosed ? fr.opportunities.hideClosed : fr.opportunities.showClosed}
          </Button>
        </div>
      )}
      {!loading && viewerProfileId && (
        <a
          href={ORGANIZATION_REQUEST_PATH}
          className="inline-flex items-center gap-1.5 self-center text-sm text-link hover:underline max-md:min-h-11"
        >
          <Building2 className="size-4" aria-hidden="true" />
          {fr.organizations.refer}
        </a>
      )}
    </div>
  );
}
