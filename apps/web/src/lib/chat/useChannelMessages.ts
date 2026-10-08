import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@kemet/shared";
import { listMessages, markChannelRead, sendMessage, toggleReaction } from "./api.js";
import { joinChannel, leaveChannel, onChatEvent } from "./socket.js";

export interface UseChannelMessagesResult {
  messages: Message[];
  loading: boolean;
  error: boolean;
  reload: () => void;
  send: (body: string, parentMessageId?: string | null) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
}

function upsertMessage(messages: Message[], incoming: Message): Message[] {
  const index = messages.findIndex((message) => message.id === incoming.id || message.clientId === incoming.clientId);
  if (index === -1) return [...messages, incoming];
  const next = messages.slice();
  next[index] = incoming;
  return next;
}

export function useChannelMessages(channelId: string | null): UseChannelMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(channelId !== null);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    let cancelled = false;
    listMessages(channelId)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items.slice().reverse());
        setLoading(false);
        const last = page.items.at(0);
        if (last) void markChannelRead(channelId, last.id);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError(true);
      });
    joinChannel(channelId);
    const unsubscribe = onChatEvent((event) => {
      if (channelIdRef.current !== channelId) return;
      if (event.type === "message:new" || event.type === "message:updated") {
        if (event.channelId !== channelId || event.message.parentMessageId) return;
        setMessages((current) => upsertMessage(current, event.message));
        if (event.type === "message:new") void markChannelRead(channelId, event.message.id);
      } else if (event.type === "message:deleted") {
        if (event.channelId !== channelId) return;
        setMessages((current) =>
          current.map((message) => (message.id === event.messageId ? { ...message, body: "", deletedAt: new Date().toISOString() } : message)),
        );
      } else if (event.type === "reaction:updated") {
        if (event.channelId !== channelId) return;
        setMessages((current) =>
          current.map((message) => (message.id === event.messageId ? { ...message, reactions: event.reactions } : message)),
        );
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
      leaveChannel(channelId);
    };
  }, [channelId, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const send = useCallback(
    async (body: string, parentMessageId: string | null = null) => {
      if (!channelId) return;
      const clientId = crypto.randomUUID();
      const message = await sendMessage(channelId, { clientId, body, parentMessageId });
      setMessages((current) => upsertMessage(current, message.message));
    },
    [channelId],
  );

  const react = useCallback(async (messageId: string, emoji: string) => {
    const result = await toggleReaction(messageId, emoji);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, reactions: result.reactions } : message)));
  }, []);

  return { messages, loading, error, reload, send, react };
}
