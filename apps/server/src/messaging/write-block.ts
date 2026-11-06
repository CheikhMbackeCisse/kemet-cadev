import type { DbOrTx } from "@kemet/db";
import type { ConversationWriteBlock } from "@kemet/shared";
import { forbidden } from "../errors.js";
import {
  countAuthorMessages,
  isBlockedEitherWay,
  listConversationMembers,
  type ConversationMemberRow,
  type ConversationRow,
} from "../api/repositories/conversations.js";

/**
 * Ce qui empêche `member` d'écrire dans la conversation, ou `null`. Une
 * demande pas encore acceptée ne laisse passer qu'un seul message : sans
 * cette limite, une demande ignorée deviendrait un canal de harcèlement.
 */
export async function findWriteBlock(
  db: DbOrTx,
  conversation: ConversationRow,
  member: ConversationMemberRow,
  channelId: string,
): Promise<ConversationWriteBlock | null> {
  if (member.status === "pending") return "pending";
  if (member.status === "left") return "alone";
  const others = (await listConversationMembers(db, [conversation.id])).filter(
    (row) => row.member.profileId !== member.profileId && row.member.status !== "left",
  );
  if (others.length === 0) return "alone";
  if (conversation.directKey && (await isBlockedEitherWay(db, member.profileId, others[0]!.member.profileId))) {
    return "blocked";
  }
  const someoneAccepted = others.some((row) => row.member.status === "accepted");
  if (!someoneAccepted && (await countAuthorMessages(db, channelId, member.profileId)) > 0) {
    return "awaiting_acceptance";
  }
  return null;
}

const WRITE_BLOCK_MESSAGES: Record<ConversationWriteBlock, string> = {
  pending: "Acceptez la demande avant de répondre.",
  awaiting_acceptance: "Votre premier message attend que la personne accepte votre demande.",
  blocked: "Vous ne pouvez plus écrire dans cette conversation.",
  alone: "Plus personne ne participe à cette conversation.",
};

export async function requireCanWrite(
  db: DbOrTx,
  conversation: ConversationRow,
  member: ConversationMemberRow,
  channelId: string,
) {
  const block = await findWriteBlock(db, conversation, member, channelId);
  if (block) throw forbidden(WRITE_BLOCK_MESSAGES[block]);
}
