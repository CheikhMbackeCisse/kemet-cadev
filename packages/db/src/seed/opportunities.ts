import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { opportunities, profiles } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { DEMO_OPPORTUNITIES } from "./opportunities-content.js";
import { daysAgo, daysFromNow } from "./time.js";

export type OpportunitiesSeedResult = { status: "done"; created: number } | { status: "skipped"; reason: string };

function isoDateInDays(days: number): string {
  return daysFromNow(days).toISOString().slice(0, 10);
}

/**
 * Ajoute les offres qui manquent, à identifiant stable : relancé, le seed ne
 * duplique rien et ne réécrit pas une offre que son auteur aurait modifiée.
 */
export async function seedOpportunities(db: DbOrTx): Promise<OpportunitiesSeedResult> {
  const handles = [...new Set(DEMO_OPPORTUNITIES.map((offer) => offer.authorHandle))];
  const authors = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(and(inArray(profiles.handle, handles), eq(profiles.isDemo, true)));
  const authorIdByHandle = new Map(authors.map((author) => [author.handle, author.id]));
  const missing = handles.filter((handle) => !authorIdByHandle.has(handle));
  if (missing.length > 0) return { status: "skipped", reason: `comptes absents : ${missing.join(", ")}` };

  const created = await db
    .insert(opportunities)
    .values(
      DEMO_OPPORTUNITIES.map((offer) => {
        const postedAt = daysAgo(offer.postedDaysAgo);
        return {
          id: demoUuid(`opportunity:${offer.key}`),
          authorId: authorIdByHandle.get(offer.authorHandle)!,
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
          createdAt: postedAt,
          updatedAt: postedAt,
        };
      }),
    )
    .onConflictDoNothing()
    .returning({ id: opportunities.id });
  return { status: "done", created: created.length };
}
