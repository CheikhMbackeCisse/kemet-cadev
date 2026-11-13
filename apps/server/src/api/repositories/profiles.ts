import { and, count, desc, eq, isNull, lt, ne, sql } from "drizzle-orm";
import {
  credentials,
  follows,
  profileBlocks,
  profiles,
  user,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import {
  ASSISTANT_MENTION_HANDLE,
  KEMET_HANDLE,
  ROLES_WITH_DETAIL,
  type UpdateProfileInput,
} from "@kemet/shared";

type ProfileRow = typeof profiles.$inferSelect;

export async function findAccountById(db: Db, userId: string) {
  const [account] = await db.select().from(user).where(eq(user.id, userId));
  if (!account)
    throw new Error(
      `Compte introuvable pour l'utilisateur ${userId} : la session référence un compte supprimé.`,
    );
  return account;
}

export async function findProfileByUserId(db: Db, userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return profile ?? null;
}

export async function isProfileDeleted(db: Db, profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  return row?.deletedAt != null;
}

/** Profil visible d'un identifiant : un figurant du seed n'existe pour personne. */
export async function findProfileByHandle(db: Db, handle: string) {
  // "/u/kocc" mène au profil système de l'assistant, rangé sous "kemet".
  const storedHandle = handle === ASSISTANT_MENTION_HANDLE ? KEMET_HANDLE : handle;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.handle, storedHandle), eq(profiles.isFiller, false)));
  return profile ?? null;
}

/** Identifiant déjà porté par un profil, figurants compris : sert seulement à refuser un doublon. */
export async function findProfileOwningHandle(db: Db, handle: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.handle, handle));
  return profile ?? null;
}

export async function listCredentials(db: Db, profileId: string) {
  return db.select().from(credentials).where(eq(credentials.profileId, profileId));
}

/**
 * La précision suit le rôle : un changement de rôle efface l'ancienne
 * précision, seul "Je code" a un mode de travail, et un freelance n'a pas
 * d'entreprise. Sans toucher au rôle ni à sa précision, rien ne change.
 */
export function withConsistentRoleDetail(
  patch: UpdateProfileInput,
  current: Pick<ProfileRow, "role" | "workMode" | "organization"> | null,
): UpdateProfileInput {
  if (
    patch.role === undefined &&
    patch.workMode === undefined &&
    patch.organization === undefined
  ) {
    return patch;
  }
  const role = patch.role !== undefined ? patch.role : (current?.role ?? null);
  const roleChanged = patch.role !== undefined && patch.role !== (current?.role ?? null);
  let workMode =
    patch.workMode !== undefined
      ? patch.workMode
      : roleChanged
        ? null
        : (current?.workMode ?? null);
  let organization =
    patch.organization !== undefined
      ? patch.organization
      : roleChanged
        ? null
        : (current?.organization ?? null);
  if (role === null || !(ROLES_WITH_DETAIL as readonly string[]).includes(role))
    organization = null;
  if (role !== "developer") workMode = null;
  if (workMode === "freelance") organization = null;
  return { ...patch, workMode, organization };
}

export async function upsertProfile(db: Db, userId: string, input: UpdateProfileInput) {
  const existing = await findProfileByUserId(db, userId);
  const patch = withConsistentRoleDetail(input, existing ?? null);
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
        workMode: patch.workMode,
        organization: patch.organization,
        title: patch.title,
        bio: patch.bio,
        stack: patch.stack,
        githubUrl: patch.githubUrl,
        gitlabUrl: patch.gitlabUrl,
        linkedinUrl: patch.linkedinUrl,
        portfolioUrl: patch.portfolioUrl,
        websiteUrl: patch.websiteUrl,
        helpsBeginners: patch.helpsBeginners,
        openToOpportunities: patch.openToOpportunities,
      })
      .returning();
    return created!;
  }
  // existing est non nul ici : la ligne vient d'être lue, update() la retourne forcément.
  const [updated] = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.userId, userId))
    .returning();
  return updated!;
}

export async function suspendProfile(db: DbOrTx, profileId: string) {
  const [profile] = await db
    .update(profiles)
    .set({ suspendedAt: new Date() })
    .where(eq(profiles.id, profileId))
    .returning();
  return profile!;
}

export async function reinstateProfile(db: Db, profileId: string) {
  const [profile] = await db
    .update(profiles)
    .set({ suspendedAt: null })
    .where(eq(profiles.id, profileId))
    .returning();
  return profile!;
}

export async function countFollowers(db: Db, profileId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(follows)
    .where(eq(follows.followeeId, profileId));
  return row?.value ?? 0;
}

export async function countFollowing(db: Db, profileId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(follows)
    .where(eq(follows.followerId, profileId));
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
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
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
  const visible = and(eq(follows.followeeId, profileId), eq(profiles.isFiller, false));
  const condition = cursor ? and(visible, lt(profiles.createdAt, new Date(cursor))) : visible;
  const rows = await db
    .select({ profile: profiles })
    .from(follows)
    .innerJoin(profiles, eq(profiles.id, follows.followerId))
    .where(condition)
    .orderBy(desc(profiles.createdAt))
    .limit(limit + 1);
  return toPage(
    rows.map((row) => row.profile),
    limit,
  );
}

export async function listFollowing(
  db: Db,
  profileId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ProfilePage> {
  const visible = and(eq(follows.followerId, profileId), eq(profiles.isFiller, false));
  const condition = cursor ? and(visible, lt(profiles.createdAt, new Date(cursor))) : visible;
  const rows = await db
    .select({ profile: profiles })
    .from(follows)
    .innerJoin(profiles, eq(profiles.id, follows.followeeId))
    .where(condition)
    .orderBy(desc(profiles.createdAt))
    .limit(limit + 1);
  return toPage(
    rows.map((row) => row.profile),
    limit,
  );
}

/**
 * Abonnés et abonnements jamais listés (figurants du seed) : ils restent dans
 * les compteurs, la liste finit par "et N autres".
 */
export async function countHiddenFollows(
  db: Db,
  profileId: string,
  side: "followers" | "following",
) {
  const [row] = await db
    .select({ value: count() })
    .from(follows)
    .innerJoin(
      profiles,
      eq(profiles.id, side === "followers" ? follows.followerId : follows.followeeId),
    )
    .where(
      and(
        eq(side === "followers" ? follows.followeeId : follows.followerId, profileId),
        eq(profiles.isFiller, true),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Candidats aux cartes "Profils ouverts aux opportunités" : comptes réels qui
 * ont coché la case, les plus récemment mis à jour d'abord. Le niveau minimal
 * est vérifié ensuite par l'appelant, comme à la lecture d'un profil.
 */
/** Profils ouverts aux opportunités, sans le lecteur ni personne qu'il bloque ou qui le bloque. */
export async function listOpenToOpportunityCandidates(
  db: Db,
  viewerId: string | null,
  limit: number,
) {
  return db
    .select()
    .from(profiles)
    .where(
      and(
        eq(profiles.openToOpportunities, true),
        eq(profiles.isFiller, false),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
        viewerId ? ne(profiles.id, viewerId) : undefined,
        viewerId
          ? sql`not exists (select 1 from ${profileBlocks} where (${profileBlocks.blockerId} = ${viewerId} and ${profileBlocks.blockedId} = ${profiles.id}) or (${profileBlocks.blockerId} = ${profiles.id} and ${profileBlocks.blockedId} = ${viewerId}))`
          : undefined,
      ),
    )
    .orderBy(desc(profiles.updatedAt))
    .limit(limit);
}
