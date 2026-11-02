import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Message } from "@kemet/shared";

/** En dessous de cette distance au bas de la liste, on considère la lecture à jour. */
const BOTTOM_THRESHOLD_PX = 80;
/** Au-dessus de cette distance du haut, la page plus ancienne est demandée. */
const LOAD_OLDER_THRESHOLD_PX = 200;

export const UNREAD_SEPARATOR_ATTRIBUTE = "data-unread-separator";

interface Options {
  listRef: RefObject<HTMLElement | null>;
  channelId: string | null;
  loading: boolean;
  messages: Message[];
  hasOlder: boolean;
  loadingOlder: boolean;
  olderError: boolean;
  loadOlder: () => Promise<void>;
  ownProfileId: string | null;
  streamingText: string | null;
  /** Nombre de messages envoyés d'ici et pas encore confirmés. */
  outgoingCount: number;
}

export interface MessageListScroll {
  newMessagesBelow: number;
  /** Vrai le temps d'insérer une page plus ancienne : la liste ne doit pas l'annoncer. */
  prependingOlder: boolean;
  onScroll: () => void;
  jumpToLatest: () => void;
  requestOlder: () => void;
}

function distanceToBottom(list: HTMLElement): number {
  return list.scrollHeight - list.scrollTop - list.clientHeight;
}

/**
 * Défilement de la liste des messages : ouverture sur le premier non-lu ou sur
 * le dernier message, chargement des pages plus anciennes en remontant sans
 * déplacer ce qui est à l'écran, et suivi du bas de la liste tant qu'on y est.
 * Les messages arrivés pendant qu'on lit plus haut sont comptés au lieu de
 * faire sauter la lecture.
 */
export function useMessageListScroll({
  listRef,
  channelId,
  loading,
  messages,
  hasOlder,
  loadingOlder,
  olderError,
  loadOlder,
  ownProfileId,
  streamingText,
  outgoingCount,
}: Options): MessageListScroll {
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const [prependingOlder, setPrependingOlder] = useState(false);
  const atBottomRef = useRef(true);
  const positionedChannelRef = useRef<string | null>(null);
  const firstIdRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const prependAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const hasMessages = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
    atBottomRef.current = true;
    setNewMessagesBelow(0);
  }, [listRef]);

  useEffect(() => {
    positionedChannelRef.current = null;
    firstIdRef.current = null;
    lastIdRef.current = null;
    prependAnchorRef.current = null;
    atBottomRef.current = true;
    setNewMessagesBelow(0);
    setPrependingOlder(false);
  }, [channelId]);

  const requestOlder = useCallback(() => {
    const list = listRef.current;
    if (!list || !hasOlder || loadingOlder) return;
    prependAnchorRef.current = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
    setPrependingOlder(true);
    void loadOlder();
  }, [listRef, hasOlder, loadingOlder, loadOlder]);

  // Passe après l'effet de mise en page du même rendu, qui a déjà consommé
  // l'ancre si une page est arrivée : seul un échec ou une page déjà connue la
  // laisse en place. La liste redevient audible au rendu suivant, une fois les
  // messages insérés.
  useEffect(() => {
    if (loadingOlder) return;
    prependAnchorRef.current = null;
    setPrependingOlder(false);
  }, [loadingOlder]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || loading || messages.length === 0) return;
    const firstId = messages[0]!.id;
    const last = messages[messages.length - 1]!;

    if (positionedChannelRef.current !== channelId) {
      positionedChannelRef.current = channelId;
      const separator = list.querySelector<HTMLElement>(`[${UNREAD_SEPARATOR_ATTRIBUTE}]`);
      if (separator) {
        list.scrollTop +=
          separator.getBoundingClientRect().top - list.getBoundingClientRect().top - 16;
        atBottomRef.current = distanceToBottom(list) < BOTTOM_THRESHOLD_PX;
      } else {
        scrollToBottom();
      }
    } else if (firstId !== firstIdRef.current && prependAnchorRef.current) {
      const anchor = prependAnchorRef.current;
      list.scrollTop = anchor.scrollTop + (list.scrollHeight - anchor.scrollHeight);
    } else if (last.id !== lastIdRef.current) {
      const previousLastIndex = messages.findIndex((message) => message.id === lastIdRef.current);
      const arrived = previousLastIndex === -1 ? 1 : messages.length - 1 - previousLastIndex;
      if (atBottomRef.current || last.authorId === ownProfileId) scrollToBottom();
      else setNewMessagesBelow((count) => count + arrived);
    }

    prependAnchorRef.current = null;
    firstIdRef.current = firstId;
    lastIdRef.current = last.id;
  }, [listRef, channelId, loading, messages, ownProfileId, scrollToBottom]);

  // Une première page trop courte pour défiler ne déclencherait jamais onScroll.
  useEffect(() => {
    const list = listRef.current;
    if (!list || loading || !hasMessages || olderError) return;
    if (list.scrollHeight <= list.clientHeight + LOAD_OLDER_THRESHOLD_PX) requestOlder();
  }, [listRef, loading, hasMessages, olderError, messages, requestOlder]);

  useLayoutEffect(() => {
    if (streamingText !== null && atBottomRef.current) scrollToBottom();
  }, [streamingText, scrollToBottom]);

  const previousOutgoingCountRef = useRef(outgoingCount);
  useLayoutEffect(() => {
    if (outgoingCount > previousOutgoingCountRef.current) scrollToBottom();
    previousOutgoingCountRef.current = outgoingCount;
  }, [outgoingCount, scrollToBottom]);

  // Une image qui finit de charger allonge le contenu, un composeur qui
  // grandit raccourcit la liste : dans les deux cas, on reste collé en bas si
  // on y était.
  useEffect(() => {
    const list = listRef.current;
    const content = list?.firstElementChild;
    if (!list || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(content);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, loading, channelId, hasMessages]);

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    atBottomRef.current = distanceToBottom(list) < BOTTOM_THRESHOLD_PX;
    if (atBottomRef.current) setNewMessagesBelow(0);
    if (list.scrollTop < LOAD_OLDER_THRESHOLD_PX) requestOlder();
  }, [listRef, requestOlder]);

  return {
    newMessagesBelow,
    prependingOlder,
    onScroll,
    jumpToLatest: scrollToBottom,
    requestOlder,
  };
}
