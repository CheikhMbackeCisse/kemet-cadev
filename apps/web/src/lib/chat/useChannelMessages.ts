import { useCallback, useEffect, useRef, useState } from "react";
import { KEMET_HANDLE, type Message, type SkillCitation } from "@kemet/shared";
import {
  getAssistantInvocation,
  listMessages,
  markChannelRead,
  sendAssistantFeedback,
  sendMessage,
  toggleReaction,
} from "./api.js";
import {
  addOutgoing,
  describeSendFailure,
  removeOutgoing,
  setOutgoingStatus,
  type OutgoingMessage,
} from "./outgoing.js";
import { joinChannel, leaveChannel, onChatEvent } from "./socket.js";

export interface AssistantStream {
  invocationId: string;
  text: string;
  failed: boolean;
  recorded: boolean;
}

export interface AssistantMeta {
  invocationId: string;
  skill: SkillCitation | null;
  helpful?: boolean | null;
  recorded: boolean;
}

/** Taille d'une page d'historique, à l'ouverture comme en remontant. */
export const MESSAGE_PAGE_SIZE = 50;

export interface UseChannelMessagesResult {
  messages: Message[];
  loading: boolean;
  error: boolean;
  /** Figé à l'ouverture du salon : ne bouge pas quand la lecture est marquée ensuite. */
  firstUnreadMessageId: string | null;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  loadOlder: () => Promise<void>;
  assistantStream: AssistantStream | null;
  assistantMetaByMessageId: Record<string, AssistantMeta>;
  reload: () => void;
  /** Messages partis du composeur que le serveur n'a pas encore renvoyés. */
  outgoing: OutgoingMessage[];
  send: (body: string, parentMessageId?: string | null, attachmentIds?: string[]) => void;
  retry: (clientId: string) => void;
  discard: (clientId: string) => void;
  react: (messageId: string, emoji: string) => Promise<void>;
  giveAssistantFeedback: (messageId: string, helpful: boolean) => Promise<void>;
}

function prependOlder(messages: Message[], older: Message[]): Message[] {
  const known = new Set(messages.map((message) => message.id));
  return [...older.filter((message) => !known.has(message.id)), ...messages];
}

function upsertMessage(messages: Message[], incoming: Message): Message[] {
  const index = messages.findIndex(
    (message) => message.id === incoming.id || message.clientId === incoming.clientId,
  );
  if (index === -1) return [...messages, incoming];
  const next = messages.slice();
  next[index] = incoming;
  return next;
}

export function useChannelMessages(
  channelId: string | null,
  hasProfile = true,
): UseChannelMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);
  const [loading, setLoading] = useState(channelId !== null);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [assistantStream, setAssistantStream] = useState<AssistantStream | null>(null);
  const [assistantMetaByMessageId, setAssistantMetaByMessageId] = useState<
    Record<string, AssistantMeta>
  >({});
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchedMetaRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFirstUnreadMessageId(null);
    setOutgoing([]);
    setOlderCursor(null);
    setOlderError(false);
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
    listMessages(channelId, undefined, MESSAGE_PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setMessages(page.items.slice().reverse());
        setOlderCursor(page.nextCursor);
        setFirstUnreadMessageId(page.firstUnreadMessageId);
        setLoading(false);
        const last = page.items.at(0);
        if (last && hasProfile) void markChannelRead(channelId, last.id);
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
        if (event.channelId !== channelId) return;
        const parentId = event.message.parentMessageId;
        if (parentId) {
          if (event.type === "message:new")
            setMessages((current) =>
              current.map((message) =>
                message.id === parentId
                  ? { ...message, replyCount: message.replyCount + 1 }
                  : message,
              ),
            );
          return;
        }
        setMessages((current) => upsertMessage(current, event.message));
        setOutgoing((current) => removeOutgoing(current, event.message.clientId));
        if (event.type === "message:new" && hasProfile)
          void markChannelRead(channelId, event.message.id);
      } else if (event.type === "message:deleted") {
        if (event.channelId !== channelId) return;
        setMessages((current) =>
          current.map((message) =>
            message.id === event.messageId
              ? { ...message, body: "", deletedAt: new Date().toISOString() }
              : message,
          ),
        );
      } else if (event.type === "reaction:updated") {
        if (event.channelId !== channelId) return;
        setMessages((current) =>
          current.map((message) =>
            message.id === event.messageId ? { ...message, reactions: event.reactions } : message,
          ),
        );
      } else if (event.type === "assistant:chunk") {
        if (event.channelId !== channelId) return;
        setAssistantStream((current) =>
          current?.invocationId === event.invocationId
            ? { ...current, text: current.text + event.delta }
            : {
                invocationId: event.invocationId,
                text: event.delta,
                failed: false,
                recorded: event.recorded,
              },
        );
      } else if (event.type === "assistant:done") {
        if (event.channelId !== channelId) return;
        setAssistantStream((current) =>
          current?.invocationId === event.invocationId ? null : current,
        );
        setAssistantMetaByMessageId((current) => ({
          ...current,
          [event.message.id]: {
            invocationId: event.invocationId,
            skill: event.skill,
            recorded: event.recorded,
          },
        }));
        setMessages((current) => upsertMessage(current, event.message));
        if (hasProfile) void markChannelRead(channelId, event.message.id);
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
  }, [channelId, reloadToken, hasProfile]);

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
            [message.id]: {
              invocationId: detail.invocationId,
              skill: detail.skill,
              helpful: detail.helpful,
              recorded: detail.recorded,
            },
          }));
        })
        .catch(() => {});
    }
  }, [messages, assistantMetaByMessageId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const loadOlder = useCallback(async () => {
    if (!channelId || !olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = await listMessages(channelId, olderCursor, MESSAGE_PAGE_SIZE);
      if (channelIdRef.current !== channelId) return;
      setMessages((current) => prependOlder(current, page.items.slice().reverse()));
      setOlderCursor(page.nextCursor);
    } catch {
      setOlderError(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [channelId, olderCursor, loadingOlder]);

  const deliver = useCallback(
    async (message: OutgoingMessage) => {
      if (!channelId) return;
      setOutgoing((current) => addOutgoing(current, { ...message, status: "sending" }));
      try {
        const result = await sendMessage(channelId, {
          clientId: message.clientId,
          body: message.body,
          parentMessageId: message.parentMessageId,
          attachmentIds: message.attachmentIds,
        });
        if (channelIdRef.current !== channelId) return;
        setMessages((current) => upsertMessage(current, result.message));
        setOutgoing((current) => removeOutgoing(current, message.clientId));
      } catch (error) {
        if (channelIdRef.current !== channelId) return;
        setOutgoing((current) =>
          setOutgoingStatus(current, message.clientId, "failed", describeSendFailure(error)),
        );
      }
    },
    [channelId],
  );

  const send = useCallback(
    (body: string, parentMessageId: string | null = null, attachmentIds: string[] = []) => {
      void deliver({
        clientId: crypto.randomUUID(),
        body,
        parentMessageId,
        attachmentIds,
        status: "sending",
      });
    },
    [deliver],
  );

  // Même clientId : le serveur ne crée pas de doublon si le premier envoi
  // était en fait arrivé.
  const retry = useCallback(
    (clientId: string) => {
      const message = outgoing.find((item) => item.clientId === clientId);
      if (message) void deliver(message);
    },
    [outgoing, deliver],
  );

  const discard = useCallback((clientId: string) => {
    setOutgoing((current) => removeOutgoing(current, clientId));
  }, []);

  const react = useCallback(async (messageId: string, emoji: string) => {
    const result = await toggleReaction(messageId, emoji);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, reactions: result.reactions } : message,
      ),
    );
  }, []);

  const giveAssistantFeedback = useCallback(
    async (messageId: string, helpful: boolean) => {
      const meta = assistantMetaByMessageId[messageId];
      if (!meta) return;
      await sendAssistantFeedback(meta.invocationId, helpful);
      setAssistantMetaByMessageId((current) => ({ ...current, [messageId]: { ...meta, helpful } }));
    },
    [assistantMetaByMessageId],
  );

  return {
    messages,
    loading,
    error,
    firstUnreadMessageId,
    hasOlder: olderCursor !== null,
    loadingOlder,
    olderError,
    loadOlder,
    assistantStream,
    assistantMetaByMessageId,
    reload,
    outgoing,
    send,
    retry,
    discard,
    react,
    giveAssistantFeedback,
  };
}
