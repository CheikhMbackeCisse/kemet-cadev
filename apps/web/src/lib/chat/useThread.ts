import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@kemet/shared";
import { listReplies, sendMessage } from "./api.js";
import {
  addOutgoing,
  describeSendFailure,
  removeOutgoing,
  setOutgoingStatus,
  type OutgoingMessage,
} from "./outgoing.js";
import { onChatEvent } from "./socket.js";

function upsert(replies: Message[], incoming: Message): Message[] {
  const index = replies.findIndex(
    (reply) => reply.id === incoming.id || reply.clientId === incoming.clientId,
  );
  if (index === -1) return [...replies, incoming];
  const next = replies.slice();
  next[index] = incoming;
  return next;
}

/** Réponses d'un fil, avec le même envoi immédiat que le salon. */
export function useThread(channelId: string | null, parentId: string | null) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const parentIdRef = useRef(parentId);
  parentIdRef.current = parentId;

  useEffect(() => {
    setReplies([]);
    setOutgoing([]);
    setError(false);
    if (!parentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    async function loadAll(id: string) {
      const all: Message[] = [];
      let cursor: string | undefined;
      do {
        const page = await listReplies(id, cursor);
        all.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor && !cancelled);
      return all;
    }
    loadAll(parentId)
      .then((items) => {
        if (!cancelled) setReplies(items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsubscribe = onChatEvent((event) => {
      if (event.type === "message:new" || event.type === "message:updated") {
        if (event.message.parentMessageId !== parentId) return;
        setReplies((current) => upsert(current, event.message));
        setOutgoing((current) => removeOutgoing(current, event.message.clientId));
      } else if (event.type === "message:deleted") {
        if (event.channelId !== channelId) return;
        setReplies((current) => current.filter((reply) => reply.id !== event.messageId));
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [channelId, parentId, reloadToken]);

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
        if (parentIdRef.current !== message.parentMessageId) return;
        setReplies((current) => upsert(current, result.message));
        setOutgoing((current) => removeOutgoing(current, message.clientId));
      } catch (error) {
        if (parentIdRef.current !== message.parentMessageId) return;
        setOutgoing((current) =>
          setOutgoingStatus(current, message.clientId, "failed", describeSendFailure(error)),
        );
      }
    },
    [channelId],
  );

  const send = useCallback(
    (body: string) => {
      if (!parentId) return;
      void deliver({
        clientId: crypto.randomUUID(),
        body,
        parentMessageId: parentId,
        attachmentIds: [],
        status: "sending",
      });
    },
    [parentId, deliver],
  );

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

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { replies, outgoing, loading, error, reload, send, retry, discard };
}
