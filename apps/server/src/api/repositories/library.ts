import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { profileCvs, projects, skills, type Db, type DbOrTx } from "@kemet/db";
import type { CvVisibility } from "@kemet/shared";

export type CvRow = typeof profileCvs.$inferSelect;

export async function findCv(db: DbOrTx, profileId: string): Promise<CvRow | null> {
  const [row] = await db.select().from(profileCvs).where(eq(profileCvs.profileId, profileId));
  return row ?? null;
}

/** Pose ou remplace le CV. Garde la visibilité déjà choisie. */
export async function upsertCv(
  db: DbOrTx,
  input: { profileId: string; storageKey: string; originalName: string; byteSize: number },
): Promise<CvRow> {
  const [row] = await db
    .insert(profileCvs)
    .values(input)
    .onConflictDoUpdate({
      target: profileCvs.profileId,
      set: {
        storageKey: input.storageKey,
        originalName: input.originalName,
        byteSize: input.byteSize,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function setCvVisibility(db: Db, profileId: string, visibility: CvVisibility) {
  const [row] = await db
    .update(profileCvs)
    .set({ visibility })
    .where(eq(profileCvs.profileId, profileId))
    .returning();
  return row ?? null;
}

export async function deleteCv(db: Db, profileId: string) {
  const [row] = await db.delete(profileCvs).where(eq(profileCvs.profileId, profileId)).returning();
  return row ?? null;
}

export async function sumUserCvBytes(db: DbOrTx, profileId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${profileCvs.byteSize}), 0)::bigint` })
    .from(profileCvs)
    .where(eq(profileCvs.profileId, profileId));
  return Number(row?.total ?? 0);
}

export async function listOwnedProjects(db: Db, ownerId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));
}

/** Skills publics seulement : la bibliothèque est lisible par tous, l'auteur compris. */
export async function listPublishedSkills(db: Db, authorId: string) {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.authorId, authorId), eq(skills.visibility, "public")))
    .orderBy(desc(skills.createdAt));
}
