import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { DEMO_ORGANIZATION_HANDLES } from "@kemet/shared";
import type { DbOrTx } from "../client.js";
import { opportunities, profiles } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { DEMO_OPPORTUNITIES } from "./opportunities-content.js";
import { daysAgo, daysFromNow } from "./time.js";

export type OpportunitiesSeedResult =
  { status: "done"; created: number } | { status: "skipped"; reason: string };

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
  // Une organisation sautée (identifiant pris par un vrai compte) retire
  // seulement ses offres ; un compte de démonstration absent arrête tout.
  const isOrganization = (handle: string) =>
    (DEMO_ORGANIZATION_HANDLES as readonly string[]).includes(handle);
  const missing = handles.filter(
    (handle) => !authorIdByHandle.has(handle) && !isOrganization(handle),
  );
  if (missing.length > 0)
    return { status: "skipped", reason: `comptes absents : ${missing.join(", ")}` };
  const offers = DEMO_OPPORTUNITIES.filter((offer) => authorIdByHandle.has(offer.authorHandle));

  const created = await db
    .insert(opportunities)
    .values(
      offers.map((offer) => {
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

  // Offres passées d'un compte de démonstration à une organisation :
  // seulement si leur auteur actuel est un profil de démonstration.
  for (const offer of offers.filter((entry) => isOrganization(entry.authorHandle))) {
    const authorId = authorIdByHandle.get(offer.authorHandle)!;
    await db
      .update(opportunities)
      .set({ authorId, organization: offer.organization, description: offer.description })
      .where(
        and(
          eq(opportunities.id, demoUuid(`opportunity:${offer.key}`)),
          ne(opportunities.authorId, authorId),
          sql`${opportunities.authorId} in (select id from profiles where is_demo)`,
        ),
      );
  }
  return { status: "done", created: created.length };
}
