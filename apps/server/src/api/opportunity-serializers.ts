import {
  isOpportunityClosed,
  type Level,
  type OpportunityDetail,
  type OpportunitySummary,
} from "@kemet/shared";
import type { OpportunityWithAuthor } from "./repositories/opportunities.js";
import { shownLevel } from "./serializers.js";

export function serializeOpportunitySummary(
  { opportunity, author }: OpportunityWithAuthor,
  today: string,
): OpportunitySummary {
  return {
    id: opportunity.id,
    slug: opportunity.slug,
    kind: opportunity.kind,
    title: opportunity.title,
    organization: opportunity.organization,
    remote: opportunity.remote,
    countryCode: opportunity.countryCode,
    city: opportunity.city,
    domains: opportunity.domains,
    contractType: opportunity.contractType,
    startDate: opportunity.startDate,
    compensationFcfa: opportunity.compensationFcfa,
    budgetMinFcfa: opportunity.budgetMinFcfa,
    budgetMaxFcfa: opportunity.budgetMaxFcfa,
    deadline: opportunity.deadline,
    closed: isOpportunityClosed(opportunity.deadline, today),
    authorId: author.id,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    authorAvatarUrl: author.avatarUrl,
    authorCountry: author.country,
    authorKind: author.kind,
    createdAt: opportunity.createdAt.toISOString(),
  };
}

export function serializeOpportunityDetail(
  row: OpportunityWithAuthor,
  authorLevel: Level,
  contactHandle: string | null,
  today: string,
): OpportunityDetail {
  return {
    ...serializeOpportunitySummary(row, today),
    authorLevel: shownLevel(row.author, authorLevel),
    contactHandle,
    description: row.opportunity.description,
    criteria: row.opportunity.criteria,
    updatedAt: row.opportunity.updatedAt.toISOString(),
  };
}
