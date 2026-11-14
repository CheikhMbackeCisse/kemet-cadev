import type { Message } from "@kemet/shared";

/** Un message supprimé quitte la liste ; supprimé dans un fil, il décompte son message d'origine. */
export function removeDeletedMessage(
  messages: Message[],
  event: { messageId: string; parentMessageId: string | null },
): Message[] {
  return messages.flatMap((message) => {
    if (message.id === event.messageId) return [];
    if (message.id === event.parentMessageId) {
      return [{ ...message, replyCount: Math.max(0, message.replyCount - 1) }];
    }
    return [message];
  });
}
