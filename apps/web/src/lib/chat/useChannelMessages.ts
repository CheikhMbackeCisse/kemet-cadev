import { useCallback, useEffect, useRef, useState } from "react";
import { KEMET_HANDLE, type Message, type SkillCitation } from "@kemet/shared";
import { getAssistantInvocation, listMessages, markChannelRead, sendAssistantFeedback, sendMessage, toggleReaction } from "./api.js";
import { joinChannel, leaveChannel, onChatEvent } from "./socket.js";

export interface AssistantStream {
  invocationId: string;
  text: string;
  failed: boolean;
}

export interface AssistantMeta {
  invocationId: string;
  skill: SkillCitation | null;
  helpful?: boolean | null;
}

export interface UseChannelMessagesResult {
  messages: Message[];
  loading: boolean;
  error: boolean;
  assistantStream: AssistantStream | null;
  assistantMetaByMessageId: Record<string, AssistantMeta>;
  reload: () => void;
  send: (body: string, parentMessageId?: string | null, attachmentIds?: string[]) => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  giveAssistantFeedback: (messageId: string, helpful: boolean) => Promise<void>;
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
  const [assistantStream, setAssistantStream] = useState<AssistantStream | null>(null);
  const [assistantMetaByMessageId, setAssistantMetaByMessageId] = useState<Record<string, AssistantMeta>>({});
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchedMetaRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    setAssistantStream(null);
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
      } else if (event.type === "assistant:chunk") {
        if (event.channelId !== channelId) return;
        setAssistantStream((current) =>
          current?.invocationId === event.invocationId
            ? { ...current, text: current.text + event.delta }
            : { invocationId: event.invocationId, text: event.delta, failed: false },
        );
      } else if (event.type === "assistant:done") {
        if (event.channelId !== channelId) return;
        setAssistantStream((current) => (current?.invocationId === event.invocationId ? null : current));
        setAssistantMetaByMessageId((current) => ({
          ...current,
          [event.message.id]: { invocationId: event.invocationId, skill: event.skill },
        }));
        setMessages((current) => upsertMessage(current, event.message));
        void markChannelRead(channelId, event.message.id);
      } else if (event.type === "assistant:failed") {
        if (event.channelId !== channelId) return;
        setAssistantStream((current) =>
          current?.invocationId === event.invocationId ? { ...current, failed: true } : current,
        );
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
      leaveChannel(channelId);
    };
  }, [channelId, reloadToken]);

  useEffect(() => {
    // Le socle (skill cité, étoile "Utile") n'est jamais recalculé sur le
    // message lui-même : il vient toujours de l'invocation. Pour les
    // messages de l'assistant déjà en base (historique chargé, ou rechargement
    // de page), ce socle arrive après coup par cet appel, jamais par
    // assistant:done qui ne couvre que la réponse en cours.
    for (const message of messages) {
      if (message.authorHandle !== KEMET_HANDLE) continue;
      if (assistantMetaByMessageId[message.id] || fetchedMetaRef.current.has(message.id)) continue;
      fetchedMetaRef.current.add(message.id);
      getAssistantInvocation(message.id)
        .then((detail) => {
          setAssistantMetaByMessageId((current) => ({
            ...current,
            [message.id]: { invocationId: detail.invocationId, skill: detail.skill, helpful: detail.helpful },
          }));
        })
        .catch(() => {});
    }
  }, [messages, assistantMetaByMessageId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const send = useCallback(
    async (body: string, parentMessageId: string | null = null, attachmentIds: string[] = []) => {
      if (!channelId) return;
      const clientId = crypto.randomUUID();
      const message = await sendMessage(channelId, { clientId, body, parentMessageId, attachmentIds });
      setMessages((current) => upsertMessage(current, message.message));
    },
    [channelId],
  );

  const react = useCallback(async (messageId: string, emoji: string) => {
    const result = await toggleReaction(messageId, emoji);
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, reactions: result.reactions } : message)));
  }, []);

  const giveAssistantFeedback = useCallback(async (messageId: string, helpful: boolean) => {
    const meta = assistantMetaByMessageId[messageId];
    if (!meta) return;
    await sendAssistantFeedback(meta.invocationId, helpful);
    setAssistantMetaByMessageId((current) => ({ ...current, [messageId]: { ...meta, helpful } }));
  }, [assistantMetaByMessageId]);

  return { messages, loading, error, assistantStream, assistantMetaByMessageId, reload, send, react, giveAssistantFeedback };
}
