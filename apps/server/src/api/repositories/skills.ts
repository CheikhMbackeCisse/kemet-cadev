import { and, avg, count, desc, eq, inArray, or } from "drizzle-orm";
import { profiles, skillRatings, skills, spaceMembers, type Db, type DbOrTx } from "@kemet/db";
import type { CreateSkillInput, UpdateSkillInput } from "@kemet/shared";

export async function findSkillBySlug(db: Db, slug: string) {
  const [skill] = await db.select().from(skills).where(eq(skills.slug, slug));
  return skill ?? null;
}

export async function findSkillById(db: DbOrTx, skillId: string) {
  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  return skill ?? null;
}

export async function findSkillsByIds(db: DbOrTx, skillIds: string[]) {
  if (skillIds.length === 0) return [];
  return db.select().from(skills).where(inArray(skills.id, skillIds));
}

/** Même règle que `FullTextRetriever`, appliquée à une ligne déjà chargée. */
export async function canViewSkill(db: Db, skill: typeof skills.$inferSelect, profileId: string): Promise<boolean> {
  if (skill.visibility === "public") return true;
  if (skill.visibility === "private") return skill.authorId === profileId;
  if (!skill.spaceId) return false;
  const [member] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, skill.spaceId), eq(spaceMembers.profileId, profileId)));
  return member != null;
}

export async function createSkill(db: Db, authorId: string, input: CreateSkillInput) {
  const [skill] = await db
    .insert(skills)
    .values({
      authorId,
      slug: input.slug,
      name: input.name,
      description: input.description,
      content: input.content,
      tags: input.tags,
      visibility: input.visibility,
      spaceId: input.spaceId ?? null,
    })
    .returning();
  return skill!;
}

export async function updateSkill(db: Db, skillId: string, input: UpdateSkillInput) {
  const [skill] = await db
    .update(skills)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.spaceId !== undefined ? { spaceId: input.spaceId } : {}),
    })
    .where(eq(skills.id, skillId))
    .returning();
  return skill!;
}

export async function deleteSkill(db: Db, skillId: string) {
  await db.delete(skills).where(eq(skills.id, skillId));
}

export async function listSkillsForViewer(db: Db, profileId: string, memberSpaceIds: string[]) {
  const visibility =
    memberSpaceIds.length > 0
      ? or(eq(skills.visibility, "public"), eq(skills.authorId, profileId), inArray(skills.spaceId, memberSpaceIds))
      : or(eq(skills.visibility, "public"), eq(skills.authorId, profileId));
  return db.select().from(skills).where(visibility).orderBy(desc(skills.createdAt));
}

export async function listMemberSpaceIds(db: Db, profileId: string) {
  const rows = await db.select({ id: spaceMembers.spaceId }).from(spaceMembers).where(eq(spaceMembers.profileId, profileId));
  return rows.map((row) => row.id);
}

export async function getSkillRatingStats(db: DbOrTx, skillId: string) {
  const [row] = await db
    .select({ average: avg(skillRatings.stars), count: count(skillRatings.id) })
    .from(skillRatings)
    .where(eq(skillRatings.skillId, skillId));
  return { average: row?.average ? Number(row.average) : null, count: row?.count ?? 0 };
}

export async function rateSkill(db: Db, skillId: string, raterId: string, stars: number) {
  await db
    .insert(skillRatings)
    .values({ skillId, raterId, stars })
    .onConflictDoUpdate({ target: [skillRatings.skillId, skillRatings.raterId], set: { stars } });
  return getSkillRatingStats(db, skillId);
}

export async function findAuthorProfile(db: DbOrTx, authorId: string) {
  const [author] = await db.select().from(profiles).where(eq(profiles.id, authorId));
  return author!;
}
