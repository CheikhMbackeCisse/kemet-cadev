import type { WorkSort, WorkType } from "@kemet/shared";
import { WORK_TYPES } from "../../components/works/workLabels.js";

export interface WorkFilters {
  q: string;
  type: WorkType | null;
  sort: WorkSort;
  tag: string;
}

// Les filtres vivent dans l'adresse : une liste filtrée se partage par un lien.
export function readWorkFilters(search: string): WorkFilters {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  return {
    q: params.get("q") ?? "",
    type: WORK_TYPES.includes(type as WorkType) ? (type as WorkType) : null,
    sort: params.get("tri") === "discussed" ? "discussed" : "recent",
    tag: params.get("tag") ?? "",
  };
}

export function workFiltersSearch(filters: WorkFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.sort !== "recent") params.set("tri", filters.sort);
  if (filters.tag) params.set("tag", filters.tag);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Type, tag et tri choisis, sans la recherche, qui reste sur la liste. */
export function countActiveWorkFilters(filters: WorkFilters): number {
  return [filters.type !== null, filters.tag !== "", filters.sort !== "recent"].filter(Boolean)
    .length;
}
