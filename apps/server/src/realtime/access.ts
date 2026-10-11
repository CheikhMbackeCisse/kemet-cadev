import { and, eq } from "drizzle-orm";
import { channels, profiles, spaceMembers, spaces, type Db } from "@kemet/db";

export async function findProfileId(db: Db, userId: string): Promise<string | null> {
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId));
  return profile?.id ?? null;
}

// `profileId` est `null` pour un visiteur (mode visiteur, lot 11a) : seuls
// les salons d'un espace public lui sont alors accessibles, jamais ceux
// d'un espace privé (la vérification d'appartenance ne s'exécute même pas).
export async function canAccessChannel(db: Db, profileId: string | null, channelId: string): Promise<boolean> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) return false;
  const [space] = await db.select().from(spaces).where(eq(spaces.id, channel.spaceId));
  if (!space) return false;
  if (space.visibility === "public") return true;
  if (!profileId) return false;
  const [membership] = await db
    .select()
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, space.id), eq(spaceMembers.profileId, profileId)));
  return membership != null;
}
