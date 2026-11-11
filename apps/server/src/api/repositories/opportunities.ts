import { and, desc, eq, gte, isNull, or, sql, type SQL } from "drizzle-orm";
import { opportunities, profiles, type Db } from "@kemet/db";
import type { ListOpportunitiesQuery, OpportunityInput } from "@kemet/shared";

export type OpportunityRow = typeof opportunities.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
export interface OpportunityWithAuthor {
  opportunity: OpportunityRow;
  author: ProfileRow;
}

function editableColumns(input: OpportunityInput) {
  return {
    kind: input.kind,
    title: input.title,
    organization: input.organization,
    remote: input.remote,
    countryCode: input.countryCode,
    city: input.city || null,
    domains: input.domains,
    description: input.description,
    contractType: input.contractType,
    startDate: input.startDate,
    compensationFcfa: input.compensationFcfa,
    budgetMinFcfa: input.budgetMinFcfa,
    budgetMaxFcfa: input.budgetMaxFcfa,
    deadline: input.deadline,
    criteria: input.criteria,
  };
}

export async function insertOpportunity(db: Db, authorId: string, slug: string, input: OpportunityInput) {
  const [row] = await db
    .insert(opportunities)
    .values({ authorId, slug, ...editableColumns(input) })
    .onConflictDoNothing({ target: opportunities.slug })
    .returning();
  return row ?? null;
}

export async function updateOpportunity(db: Db, opportunityId: string, input: OpportunityInput) {
  const [row] = await db
    .update(opportunities)
    .set(editableColumns(input))
    .where(eq(opportunities.id, opportunityId))
    .returning();
  return row!;
}

export async function softDeleteOpportunity(db: Db, opportunityId: string) {
  await db.update(opportunities).set({ deletedAt: new Date() }).where(eq(opportunities.id, opportunityId));
}

// Un compte suspendu ne peut plus répondre à qui postule : ses offres
// disparaissent jusqu'à sa réintégration.
/** Offre visible : ni supprimée, ni d'un compte supprimé, suspendu ou figurant. */
function visible(): SQL {
  return and(
    isNull(opportunities.deletedAt),
    isNull(profiles.deletedAt),
    isNull(profiles.suspendedAt),
    eq(profiles.isFiller, false),
  )!;
}

/** Pour la modération : l'offre telle quelle, même masquée. */
export async function findOpportunityById(db: Db, id: string): Promise<OpportunityRow | null> {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  return row ?? null;
}

export async function findOpportunityBySlug(db: Db, slug: string): Promise<OpportunityWithAuthor | null> {
  const [row] = await db
    .select({ opportunity: opportunities, author: profiles })
    .from(opportunities)
    .innerJoin(profiles, eq(profiles.id, opportunities.authorId))
    .where(and(eq(opportunities.slug, slug), visible()));
  return row ?? null;
}

export async function listOpportunities(
  db: Db,
  query: ListOpportunitiesQuery,
  today: string,
): Promise<{ items: OpportunityWithAuthor[]; nextCursor: string | null }> {
  const conditions: SQL[] = [visible()];
  if (query.kind) conditions.push(eq(opportunities.kind, query.kind));
  if (query.country) conditions.push(eq(opportunities.countryCode, query.country));
  if (query.domain) conditions.push(sql`${query.domain} = any(${opportunities.domains})`);
  if (query.author) conditions.push(eq(profiles.handle, query.author));
  if (!query.includeClosed) {
    conditions.push(or(isNull(opportunities.deadline), gte(opportunities.deadline, today))!);
  }
  if (query.cursor) {
    // Comparé en base, à la microseconde : une date passée par le client
    // perdrait les offres créées dans la même milliseconde.
    conditions.push(
      sql`(${opportunities.createdAt}, ${opportunities.id}) < (select o.created_at, o.id from opportunities o where o.id = ${query.cursor})`,
    );
  }
  const rows = await db
    .select({ opportunity: opportunities, author: profiles })
    .from(opportunities)
    .innerJoin(profiles, eq(profiles.id, opportunities.authorId))
    .where(and(...conditions))
    .orderBy(desc(opportunities.createdAt), desc(opportunities.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? last.opportunity.id : null,
  };
}
