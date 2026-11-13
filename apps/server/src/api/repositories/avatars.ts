import { eq, sql } from "drizzle-orm";
import { profileAvatars, profiles, type DbOrTx } from "@kemet/db";

export type AvatarRow = typeof profileAvatars.$inferSelect;

/** Adresse publique d'une photo : la clé change à chaque envoi, le cache peut durer. */
export function avatarUrl(storageKey: string): string {
  return `/api/avatars/${storageKey}`;
}

export async function findAvatar(db: DbOrTx, profileId: string): Promise<AvatarRow | null> {
  const [row] = await db
    .select()
    .from(profileAvatars)
    .where(eq(profileAvatars.profileId, profileId));
  return row ?? null;
}

export async function findAvatarByKey(db: DbOrTx, storageKey: string): Promise<AvatarRow | null> {
  const [row] = await db
    .select()
    .from(profileAvatars)
    .where(eq(profileAvatars.storageKey, storageKey));
  return row ?? null;
}

/** Pose ou remplace la photo, et l'adresse lue partout par `profiles.avatar_url`. */
export async function upsertAvatar(
  db: DbOrTx,
  input: { profileId: string; storageKey: string; mimeType: string; byteSize: number },
): Promise<void> {
  await db
    .insert(profileAvatars)
    .values(input)
    .onConflictDoUpdate({
      target: profileAvatars.profileId,
      set: {
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        updatedAt: new Date(),
      },
    });
  await db
    .update(profiles)
    .set({ avatarUrl: avatarUrl(input.storageKey) })
    .where(eq(profiles.id, input.profileId));
}

export async function sumUserAvatarBytes(db: DbOrTx, profileId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${profileAvatars.byteSize}), 0)::bigint` })
    .from(profileAvatars)
    .where(eq(profileAvatars.profileId, profileId));
  return Number(row?.total ?? 0);
}

/**
 * Retire la photo envoyée (suspension par la modération) : la ligne et
 * l'adresse partent ici, le fichier est effacé par l'appelant une fois la
 * transaction validée. Une photo du seed ou un logo d'organisation n'a pas
 * de ligne et reste en place.
 */
export async function removeAvatar(db: DbOrTx, profileId: string): Promise<string | null> {
  const [removed] = await db
    .delete(profileAvatars)
    .where(eq(profileAvatars.profileId, profileId))
    .returning({ storageKey: profileAvatars.storageKey });
  if (!removed) return null;
  await db.update(profiles).set({ avatarUrl: null }).where(eq(profiles.id, profileId));
  return removed.storageKey;
}
