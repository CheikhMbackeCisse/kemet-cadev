import type { profiles } from "@kemet/db";
import type { Conversation, ConversationParticipant, Level } from "@kemet/shared";
import type { ConversationListRow, ConversationMemberRow } from "./repositories/conversations.js";

type ProfileRow = typeof profiles.$inferSelect;

export interface ConversationMemberWithProfile {
  member: ConversationMemberRow;
  profile: ProfileRow;
}

function serializeParticipant(row: ConversationMemberWithProfile, level: Level): ConversationParticipant {
  return {
    profileId: row.profile.id,
    handle: row.profile.handle,
    displayName: row.profile.displayName,
    avatarUrl: row.profile.avatarUrl,
    country: row.profile.country,
    level,
    status: row.member.status,
  };
}

/** Les autres membres seulement : la personne connectée se connaît. Ceux qui sont partis disparaissent. */
export function serializeConversation(
  row: ConversationListRow,
  members: ConversationMemberWithProfile[],
  levels: Map<string, Level>,
  viewerId: string,
  unreadCount: number,
): Conversation {
  const deleted = row.lastMessage?.deletedAt != null;
  return {
    id: row.id,
    channelId: row.channelId,
    isGroup: row.directKey === null,
    work: row.work,
    participants: members
      .filter((entry) => entry.member.profileId !== viewerId && entry.member.status !== "left")
      .map((entry) => serializeParticipant(entry, levels.get(entry.profile.id)!)),
    viewerStatus: row.status,
    lastMessage: row.lastMessage
      ? {
          authorId: row.lastMessage.authorId,
          body: deleted ? "" : row.lastMessage.body,
          hasAttachments: !deleted && row.lastMessage.hasAttachments,
          hasVoice: !deleted && row.lastMessage.hasVoice,
          deleted,
          createdAt: row.lastMessage.createdAt.toISOString(),
        }
      : null,
    unreadCount,
    createdAt: row.createdAt.toISOString(),
  };
}
