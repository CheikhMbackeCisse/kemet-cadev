import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, ConversationBox } from "@kemet/shared";
import { listConversations } from "../chat/api.js";
import { onConversationActivity } from "../chat/socket.js";

export interface ConversationListState {
  items: Conversation[];
  status: "loading" | "error" | "ready";
  hasMore: boolean;
  loadingMore: boolean;
  reload: () => void;
  loadMore: () => Promise<void>;
}

/**
 * Une boîte (messages ou demandes), relue en entier à chaque activité
 * poussée par le serveur : l'ordre dépend du dernier message, une mise à
 * jour en place déplacerait les lignes sous le doigt sans rien de plus sûr.
 */
export function useConversationList(box: ConversationBox, enabled: boolean): ConversationListState {
  const [items, setItems] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<ConversationListState["status"]>("loading");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async (showLoading: boolean) => {
      const request = ++requestRef.current;
      if (showLoading) setStatus("loading");
      try {
        const page = await listConversations(box);
        if (request !== requestRef.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setStatus("ready");
      } catch {
        if (request !== requestRef.current) return;
        // Un rafraîchissement silencieux raté garde la liste affichée.
        if (showLoading) setStatus("error");
      }
    },
    [box],
  );

  useEffect(() => {
    if (!enabled) return;
    void load(true);
    return onConversationActivity(() => void load(false));
  }, [enabled, load]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listConversations(box, cursor);
      setItems((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [box, cursor, loadingMore]);

  const reload = useCallback(() => void load(true), [load]);

  return { items, status, hasMore: cursor !== null, loadingMore, reload, loadMore };
}
