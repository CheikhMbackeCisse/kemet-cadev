import type { skills, profiles } from "@kemet/db";
import type { SkillDetail, SkillSummary } from "@kemet/shared";

type SkillRow = typeof skills.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type RatingStats = { average: number | null; count: number };
type SkillStats = RatingStats & { uses: number };

export function serializeSkillSummary(row: SkillRow, author: ProfileRow, ratings: SkillStats): SkillSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    tags: row.tags,
    visibility: row.visibility,
    isBeginner: row.isBeginner,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    averageStars: ratings.average,
    ratingCount: ratings.count,
    usageCount: ratings.uses,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSkillDetail(row: SkillRow, author: ProfileRow, ratings: SkillStats): SkillDetail {
  return {
    ...serializeSkillSummary(row, author, ratings),
    content: row.content,
    spaceId: row.spaceId,
  };
}
