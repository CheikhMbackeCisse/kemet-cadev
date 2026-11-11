import { Briefcase } from "lucide-react";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { listFeedProjects, listOpportunities, type OpportunityFilters as ApiFilters } from "../../lib/chat/api.js";
import { mergeOpportunities } from "../../lib/opportunities/mergeOpportunities.js";
import { navigate } from "../../lib/navigation/navigate.js";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import { EmptyState } from "../ui/EmptyState.js";
import { ErrorState } from "../ui/ErrorState.js";
import { ProjectFeedCard } from "../feed/ProjectFeedCard.js";
import { ALL, NO_FILTERS, OpportunityFilters, type OpportunityFilterValues } from "./OpportunityFilters.js";
import { OpportunityRow, OpportunityRowSkeleton } from "./OpportunityRow.js";

const PROJECTS_IN_LIST = 20;

function toApiFilters(filters: OpportunityFilterValues, includeClosed: boolean): ApiFilters {
  return {
    kind: filters.kind === ALL || filters.kind === "project" ? undefined : filters.kind,
    country: filters.country === ALL ? undefined : filters.country,
    domain: filters.domain === ALL ? undefined : filters.domain,
    includeClosed,
  };
}

/** Onglet Opportunités du fil : offres et projets qui cherchent des membres, filtrables. */
export function OpportunitiesFeed({ viewerProfileId }: { viewerProfileId: string | null }) {
  const [filters, setFilters] = useState<OpportunityFilterValues>(NO_FILTERS);
  const [includeClosed, setIncludeClosed] = useState(false);
  const apiFilters = toApiFilters(filters, includeClosed);
  const offersOnlyProjects = filters.kind === "project";

  const offers = useInfiniteQuery({
    queryKey: ["opportunities", apiFilters],
    queryFn: ({ pageParam }) => listOpportunities(apiFilters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: !offersOnlyProjects,
  });
  // Les projets accompagnent les offres : sans eux, la liste reste lisible.
  const projects = useQuery({
    queryKey: ["feed", "projects", PROJECTS_IN_LIST],
    queryFn: () => listFeedProjects("pour-toi", PROJECTS_IN_LIST).catch(() => ({ items: [] })),
  });

  const offerItems = offersOnlyProjects ? [] : (offers.data?.pages.flatMap((page) => page.items) ?? []);
  const entries = mergeOpportunities(offerItems, projects.data?.items ?? [], filters);
  const loading = (!offersOnlyProjects && offers.isPending) || projects.isPending;
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
        message={filtered ? fr.opportunities.emptyFiltered : fr.opportunities.empty}
        action={
          filtered
            ? { label: fr.opportunities.clearFilters, onClick: () => setFilters(NO_FILTERS) }
            : viewerProfileId
              ? { label: fr.opportunities.publish, onClick: () => navigate("/opportunites/nouvelle") }
              : undefined
        }
      />
    );
  } else {
    content = (
      <ul className="flex flex-col divide-y divide-border">
        {entries.map((entry) =>
          entry.kind === "offer" ? (
            <OpportunityRow key={`offer:${entry.item.id}`} opportunity={entry.item} />
          ) : (
            <ProjectFeedCard
              key={`project:${entry.item.id}`}
              project={entry.item}
              variant="row"
              viewerProfileId={viewerProfileId}
            />
          ),
        )}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <OpportunityFilters value={filters} onChange={setFilters} />
      {content}
      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {offers.hasNextPage && (
            <Button variant="secondary" onClick={() => void offers.fetchNextPage()} disabled={offers.isFetchingNextPage}>
              {fr.opportunities.loadMore}
            </Button>
          )}
          {!offersOnlyProjects && (
            <Button variant="ghost" onClick={() => setIncludeClosed((current) => !current)}>
              {includeClosed ? fr.opportunities.hideClosed : fr.opportunities.showClosed}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
