import { io, type Socket } from "socket.io-client";
import type { ChatEvent } from "@kemet/shared";

export interface TypingEvent {
  channelId: string;
  profileId: string;
  state: "start" | "stop";
}

type ChatEventHandler = (event: ChatEvent) => void;
type TypingHandler = (event: TypingEvent) => void;

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io({ withCredentials: true });
  }
  return socket;
}

export function joinChannel(channelId: string): void {
  getSocket().emit("channel:join", { channelId });
}

export function leaveChannel(channelId: string): void {
  getSocket().emit("channel:leave", { channelId });
}

export function notifyTyping(channelId: string, state: "start" | "stop"): void {
  getSocket().emit(`typing:${state}`, { channelId });
}

const EVENT_TYPES: ChatEvent["type"][] = [
  "message:new",
  "message:updated",
  "message:deleted",
  "reaction:updated",
  "member:removed",
  "assistant:chunk",
  "assistant:done",
  "assistant:failed",
];

export function onChatEvent(handler: ChatEventHandler): () => void {
  const client = getSocket();
  for (const type of EVENT_TYPES) client.on(type, handler);
  return () => {
    for (const type of EVENT_TYPES) client.off(type, handler);
  };
}

/**
 * Activité dans une conversation privée dont on est membre, reçue où qu'on
 * soit dans l'application (salle personnelle côté serveur). Sans contenu :
 * de quoi relire la liste et les pastilles.
 */
export function onConversationActivity(handler: (conversationId: string) => void): () => void {
  const client = getSocket();
  const listener = (event: { conversationId: string }) => handler(event.conversationId);
  client.on("conversation:activity", listener);
  return () => {
    client.off("conversation:activity", listener);
  };
}

export function onTyping(handler: TypingHandler): () => void {
  const client = getSocket();
  const onStart = (event: Omit<TypingEvent, "state">) => handler({ ...event, state: "start" });
  const onStop = (event: Omit<TypingEvent, "state">) => handler({ ...event, state: "stop" });
  client.on("typing:start", onStart);
  client.on("typing:stop", onStop);
  return () => {
    client.off("typing:start", onStart);
    client.off("typing:stop", onStop);
  };
}
