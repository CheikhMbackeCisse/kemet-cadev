import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  opportunityListSearch,
  readOpportunityListState,
  withoutOpportunityParams,
} from "./listState.js";

describe("filtres des Opportunités dans l'adresse", () => {
  it("relit les filtres écrits, onglet compris", () => {
    const state = {
      filters: { kind: "mission" as const, country: "SN", domain: "data" },
      includeClosed: true,
    };
    const search = opportunityListSearch("?onglet=opportunites", state);
    expect(search).toBe("?onglet=opportunites&type=mission&pays=SN&domaine=data&cloturees=1");
    expect(readOpportunityListState(search)).toEqual(state);
  });

  it("n'écrit rien pour une valeur Tous", () => {
    expect(
      opportunityListSearch("?onglet=opportunites&type=job", {
        filters: NO_FILTERS,
        includeClosed: false,
      }),
    ).toBe("?onglet=opportunites");
  });

  it("ignore une valeur inconnue, un pays hors d'Afrique ou le domaine Autre", () => {
    expect(readOpportunityListState("?type=cdi&pays=FR&domaine=other&cloturees=oui")).toEqual({
      filters: NO_FILTERS,
      includeClosed: false,
    });
  });

  it("retire les filtres en quittant l'onglet", () => {
    expect(withoutOpportunityParams("?onglet=opportunites&type=job&pays=SN")).toBe(
      "?onglet=opportunites",
    );
    expect(withoutOpportunityParams("?type=job")).toBe("");
  });
});
