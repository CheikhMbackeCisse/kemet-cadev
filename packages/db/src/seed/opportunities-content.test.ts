import { createOpportunitySchema } from "@kemet/shared";
import { describe, expect, it } from "vitest";
import { DEMO_OPPORTUNITIES } from "./opportunities-content.js";

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("offres de démonstration", () => {
  it.each(DEMO_OPPORTUNITIES.map((offer) => [offer.slug, offer] as const))(
    "%s passe la validation d'une vraie publication",
    (_slug, offer) => {
      const result = createOpportunitySchema.safeParse({
        slug: offer.slug,
        kind: offer.kind,
        title: offer.title,
        organization: offer.organization,
        remote: offer.remote,
        countryCode: offer.countryCode,
        city: offer.city,
        domains: offer.domains,
        description: offer.description,
        contractType: offer.contractType,
        startDate: offer.startInDays === null ? null : isoDateInDays(offer.startInDays),
        compensationFcfa: offer.compensationFcfa,
        budgetMinFcfa: offer.budgetMinFcfa,
        budgetMaxFcfa: offer.budgetMaxFcfa,
        deadline: offer.deadlineInDays === null ? null : isoDateInDays(offer.deadlineInDays),
        criteria: offer.criteria,
      });
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    },
  );

  it("couvre les trois types, plusieurs pays et une offre clôturée", () => {
    expect(new Set(DEMO_OPPORTUNITIES.map((offer) => offer.kind))).toEqual(
      new Set(["job", "internship", "mission"]),
    );
    expect(DEMO_OPPORTUNITIES.filter((offer) => offer.kind === "mission")).toHaveLength(4);
    expect(
      new Set(DEMO_OPPORTUNITIES.map((offer) => offer.countryCode).filter(Boolean)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      DEMO_OPPORTUNITIES.some((offer) => offer.deadlineInDays !== null && offer.deadlineInDays < 0),
    ).toBe(true);
    expect(new Set(DEMO_OPPORTUNITIES.map((offer) => offer.slug)).size).toBe(
      DEMO_OPPORTUNITIES.length,
    );
  });

  it("n'écrit aucune barre d'écriture inclusive", () => {
    for (const offer of DEMO_OPPORTUNITIES) {
      expect(`${offer.title} ${offer.description}`).not.toMatch(/\w[/·.]e\b|\(e\)/);
    }
  });
});
