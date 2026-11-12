import type { FeedProject, OpportunitySummary } from "@kemet/shared";

export type OpportunityEntry =
  { kind: "offer"; item: OpportunitySummary } | { kind: "project"; item: FeedProject };

export interface MergeFilters {
  kind: string;
  country: string;
  domain: string;
}

const ALL = "all";

/**
 * Offres (déjà filtrées par le serveur) et projets qui cherchent des membres,
 * du plus récent au plus ancien. Un projet n'a ni domaine ni pays : il suit le
 * pays de son auteur, et sort de la liste dès qu'un domaine est choisi.
 */
export function mergeOpportunities(
  offers: OpportunitySummary[],
  projects: FeedProject[],
  filters: MergeFilters,
): OpportunityEntry[] {
  const showOffers = filters.kind !== "project";
  const showProjects =
    (filters.kind === ALL || filters.kind === "project") && filters.domain === ALL;
  const entries: OpportunityEntry[] = [
    ...(showOffers ? offers.map((item) => ({ kind: "offer" as const, item })) : []),
    ...(showProjects
      ? projects
          .filter((project) => project.openRoles.length > 0)
          .filter((project) => filters.country === ALL || project.ownerCountry === filters.country)
          .map((item) => ({ kind: "project" as const, item }))
      : []),
  ];
  return entries.sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt));
}
