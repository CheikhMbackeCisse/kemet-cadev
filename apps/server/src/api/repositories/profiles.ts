import { and, count, desc, eq, lt } from "drizzle-orm";
import { credentials, follows, profiles, user, type Db } from "@kemet/db";
import type { UpdateProfileInput } from "@kemet/shared";

export async function findAccountById(db: Db, userId: string) {
  const [account] = await db.select().from(user).where(eq(user.id, userId));
  if (!account) throw new Error(`Compte introuvable pour l'utilisateur ${userId} : la session référence un compte supprimé.`);
  return account;
}

export async function findProfileByUserId(db: Db, userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return profile ?? null;
}

export async function isProfileDeleted(db: Db, profileId: string): Promise<boolean> {
  const [row] = await db.select({ deletedAt: profiles.deletedAt }).from(profiles).where(eq(profiles.id, profileId));
  return row?.deletedAt != null;
}

export async function findProfileByHandle(db: Db, handle: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.handle, handle));
  return profile ?? null;
}

export async function listCredentials(db: Db, profileId: string) {
  return db.select().from(credentials).where(eq(credentials.profileId, profileId));
}

export async function upsertProfile(db: Db, userId: string, patch: UpdateProfileInput) {
  const existing = await findProfileByUserId(db, userId);
  if (!existing) {
    // Validé par l'appelant : handle et displayName sont requis à la création.
    // Pays vide tant qu'il n'est pas choisi, comme pour un compte supprimé.
    const [created] = await db
      .insert(profiles)
      .values({
        userId,
        handle: patch.handle!,
        displayName: patch.displayName!,
        country: patch.country ?? "",
        role: patch.role,
        title: patch.title,
        bio: patch.bio,
        stack: patch.stack,
        githubUrl: patch.githubUrl,
        openToOpportunities: patch.openToOpportunities,
      })
      .returning();
    return created!;
  }
  // existing est non nul ici : la ligne vient d'être lue, update() la retourne forcément.
  const [updated] = await db.update(profiles).set(patch).where(eq(profiles.userId, userId)).returning();
  return updated!;
}

export async function suspendProfile(db: Db, profileId: string) {
  const [profile] = await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, profileId)).returning();
  return profile!;
}

export async function reinstateProfile(db: Db, profileId: string) {
  const [profile] = await db.update(profiles).set({ suspendedAt: null }).where(eq(profiles.id, profileId)).returning();
  return profile!;
}

export async function countFollowers(db: Db, profileId: string) {
  const [row] = await db.select({ value: count() }).from(follows).where(eq(follows.followeeId, profileId));
  return row?.value ?? 0;
}

export async function countFollowing(db: Db, profileId: string) {
  const [row] = await db.select({ value: count() }).from(follows).where(eq(follows.followerId, profileId));
  return row?.value ?? 0;
}

export async function isFollowing(db: Db, followerId: string, followeeId: string) {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
  return row != null;
}

export async function createFollow(db: Db, followerId: string, followeeId: string) {
  await db.insert(follows).values({ followerId, followeeId }).onConflictDoNothing();
}

export async function deleteFollow(db: Db, followerId: string, followeeId: string) {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

export interface ProfilePage {
  items: (typeof profiles.$inferSelect)[];
  nextCursor: string | null;
}

function toPage(rows: (typeof profiles.$inferSelect)[], limit: number): ProfilePage {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.createdAt.toISOString() : null };
}

export async function listFollowers(
  db: Db,
  profileId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ProfilePage> {
  const condition = cursor
    ? and(eq(follows.followeeId, profileId), lt(profiles.createdAt, new Date(cursor)))
    : eq(follows.followeeId, profileId);
  const rows = await db
    .select({ profile: profiles })
    .from(follows)
    .innerJoin(profiles, eq(profiles.id, follows.followerId))
    .where(condition)
    .orderBy(desc(profiles.createdAt))
    .limit(limit + 1);
  return toPage(rows.map((row) => row.profile), limit);
}

export async function listFollowing(
  db: Db,
  profileId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ProfilePage> {
  const condition = cursor
    ? and(eq(follows.followerId, profileId), lt(profiles.createdAt, new Date(cursor)))
    : eq(follows.followerId, profileId);
  const rows = await db
    .select({ profile: profiles })
    .from(follows)
    .innerJoin(profiles, eq(profiles.id, follows.followeeId))
    .where(condition)
    .orderBy(desc(profiles.createdAt))
    .limit(limit + 1);
  return toPage(rows.map((row) => row.profile), limit);
}
