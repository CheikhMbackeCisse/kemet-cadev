import type { DbOrTx } from "@kemet/db";
import type { ChatPublisher } from "../chat/pubsub.js";
import { listActiveMemberIds } from "../api/repositories/conversations.js";

/** Prévient chaque membre encore présent, pour ses pastilles et sa liste de conversations. */
export async function publishConversationActivity(db: DbOrTx, chat: ChatPublisher, conversationId: string) {
  const profileIds = await listActiveMemberIds(db, conversationId);
  await chat.publish({ type: "conversation:activity", conversationId, profileIds });
}
