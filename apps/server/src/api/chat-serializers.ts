import type { channels, messages, profiles, spaceInvites, spaceMembers, spaces } from "@kemet/db";
import type { Channel, Invite, Message, Reaction, Space, SpaceMember } from "@kemet/shared";

type SpaceRow = typeof spaces.$inferSelect;
type ChannelRow = typeof channels.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type SpaceMemberRole = (typeof spaceMembers.$inferSelect)["role"];
type InviteRow = typeof spaceInvites.$inferSelect;

export function serializeSpace(row: SpaceRow, role: SpaceMemberRole | null): Space {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility,
    role,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeSpaceMember(row: { profile: ProfileRow; role: SpaceMemberRole; joinedAt: Date }): SpaceMember {
  return {
    profileId: row.profile.id,
    handle: row.profile.handle,
    displayName: row.profile.displayName,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  };
}

export function serializeChannel(row: ChannelRow, unreadCount: number): Channel {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    slug: row.slug,
    displayOrder: row.displayOrder,
    unreadCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeMessage(
  row: MessageRow,
  author: ProfileRow,
  mentionedHandles: string[],
  reactions: Reaction[],
  replyCount: number,
): Message {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    channelId: row.channelId,
    parentMessageId: row.parentMessageId,
    clientId: row.clientId,
    authorId: row.authorId,
    authorHandle: author.handle,
    authorDisplayName: author.displayName,
    body: deleted ? "" : row.body,
    mentionedHandles: deleted ? [] : mentionedHandles,
    reactions,
    replyCount,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function serializeInvite(row: InviteRow, createdByHandle: string): Invite {
  return {
    id: row.id,
    code: row.code,
    createdByHandle,
    maxUses: row.maxUses,
    useCount: row.useCount,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
