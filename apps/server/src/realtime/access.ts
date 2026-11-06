import { and, eq, ne } from "drizzle-orm";
import { channels, conversationMembers, profiles, spaceMembers, spaces, type Db } from "@kemet/db";

export async function findProfileId(db: Db, userId: string): Promise<string | null> {
  const [profile] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId));
  return profile?.id ?? null;
}

/**
 * Même règle que `requireChannelAccess` côté API. `profileId` est `null`
 * pour un visiteur : seuls les salons d'un espace public lui sont ouverts,
 * jamais une conversation privée.
 */
export async function canAccessChannel(db: Db, profileId: string | null, channelId: string): Promise<boolean> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) return false;
  if (channel.conversationId) {
    if (!profileId) return false;
    const [member] = await db
      .select({ id: conversationMembers.id })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, channel.conversationId),
          eq(conversationMembers.profileId, profileId),
          ne(conversationMembers.status, "left"),
        ),
      );
    return member != null;
  }
  if (!channel.spaceId) return false;
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
