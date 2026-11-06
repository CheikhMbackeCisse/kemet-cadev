import { useEffect, useSyncExternalStore } from "react";
import type { ConversationUnreadSummary } from "@kemet/shared";
import { getConversationUnread } from "../chat/api.js";
import { onConversationActivity } from "../chat/socket.js";

/**
 * Pastilles de la messagerie, partagées par la barre d'activité, la barre
 * d'onglets mobile et la page Messages : une seule requête pour toutes, relue
 * à chaque activité poussée par le serveur et au retour sur l'onglet.
 */
let summary: ConversationUnreadSummary | null = null;
let subscriberCount = 0;
let inFlight: Promise<void> | null = null;
let stopListening: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function refreshConversationUnread(): Promise<void> {
  inFlight ??= getConversationUnread()
    .then((next) => {
      summary = next;
      emit();
    })
    // Une pastille qui ne se met pas à jour n'empêche rien : on garde la précédente.
    .catch(() => {})
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function handleVisibility() {
  if (document.visibilityState === "visible") void refreshConversationUnread();
}

function start() {
  void refreshConversationUnread();
  const unsubscribe = onConversationActivity(() => void refreshConversationUnread());
  document.addEventListener("visibilitychange", handleVisibility);
  stopListening = () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

function stop() {
  stopListening?.();
  stopListening = null;
  summary = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `null` tant que rien n'est chargé, ou pour un visiteur (`enabled` faux). */
export function useConversationUnread(enabled: boolean): ConversationUnreadSummary | null {
  useEffect(() => {
    if (!enabled) return;
    subscriberCount += 1;
    if (subscriberCount === 1) start();
    return () => {
      subscriberCount -= 1;
      if (subscriberCount === 0) stop();
    };
  }, [enabled]);
  const value = useSyncExternalStore(subscribe, () => summary);
  return enabled ? value : null;
}

/** Ce que porte la pastille : conversations avec du non-lu, plus les demandes en attente. */
export function messagesBadgeCount(value: ConversationUnreadSummary | null): number {
  return value ? value.unreadConversations + value.pendingRequests : 0;
}
