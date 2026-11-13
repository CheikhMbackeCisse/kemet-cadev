import { describe, expect, it } from "vitest";
import { countActiveWorkFilters, readWorkFilters, workFiltersSearch } from "./filters.js";

describe("filtres des travaux", () => {
  it("relit ce qu'il écrit dans l'adresse", () => {
    const filters = {
      q: "manioc",
      type: "thesis_research" as const,
      sort: "discussed" as const,
      tag: "ia",
    };
    expect(readWorkFilters(workFiltersSearch(filters))).toEqual(filters);
  });

  it("écarte un type inconnu et n'écrit rien pour les valeurs par défaut", () => {
    expect(readWorkFilters("?type=inconnu").type).toBeNull();
    expect(workFiltersSearch({ q: "", type: null, sort: "recent", tag: "" })).toBe("");
  });

  it("ne compte pas la recherche parmi les filtres", () => {
    expect(countActiveWorkFilters({ q: "manioc", type: null, sort: "recent", tag: "" })).toBe(0);
    expect(countActiveWorkFilters({ q: "", type: "article", sort: "discussed", tag: "ia" })).toBe(
      3,
    );
  });
});
