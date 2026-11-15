import { isAssistantHandle, type Level, type Message } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";
import { LOCALE } from "../../i18n/language.js";

const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface MessageGroup {
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorCountry: string | null;
  authorLevel: Level | null;
  messages: Message[];
}

export type TimelineItem =
  | { type: "day"; key: string; label: string }
  | { type: "unread"; key: string }
  | { type: "group"; key: string; group: MessageGroup };

export interface UnreadMarker {
  firstUnreadMessageId: string | null;
  /** Des messages plus anciens restent à charger au-dessus de la liste. */
  hasOlder: boolean;
}

/**
 * Position du séparateur "Nouveaux messages". Si le premier non-lu n'est pas
 * encore chargé alors que l'historique continue au-dessus, tout ce qui est
 * affiché est non lu : le séparateur se place en tête, et descend à sa vraie
 * place quand la page qui le contient arrive.
 */
function unreadIndex(messages: Message[], marker: UnreadMarker | undefined): number {
  if (!marker?.firstUnreadMessageId) return -1;
  const index = messages.findIndex((message) => message.id === marker.firstUnreadMessageId);
  if (index !== -1) return index;
  return marker.hasOlder && messages.length > 0 ? 0 : -1;
}

/** Jour calendaire local d'une date, pour comparer deux messages. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Aujourd'hui", "Hier", "18 octobre", ou "18 octobre 2025" hors de l'année en cours. */
export function formatDayLabel(date: Date, now: Date): string {
  if (dayKey(date) === dayKey(now)) return fr.chat.today;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return fr.chat.yesterday;
  return date.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Regroupe les messages consécutifs d'une même personne sous un seul avatar
 * (DESIGN.md, « Message ») et insère un séparateur à chaque changement de
 * jour : sans lui, une heure de la veille semble arriver après celle du jour.
 * Un groupe ne traverse jamais minuit, ni le séparateur "Nouveaux messages".
 */
export function buildTimeline(
  messages: Message[],
  now: Date = new Date(),
  unread?: UnreadMarker,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let currentDay: string | null = null;
  let last: MessageGroup | null = null;
  const firstUnread = unreadIndex(messages, unread);

  for (const [index, message] of messages.entries()) {
    const createdAt = new Date(message.createdAt);
    const day = dayKey(createdAt);
    if (day !== currentDay) {
      items.push({ type: "day", key: `day-${day}`, label: formatDayLabel(createdAt, now) });
      currentDay = day;
      last = null;
    }
    if (index === firstUnread) {
      items.push({ type: "unread", key: "unread" });
      last = null;
    }

    const lastMessage = last?.messages[last.messages.length - 1];
    const withinWindow = lastMessage
      ? createdAt.getTime() - new Date(lastMessage.createdAt).getTime() < MESSAGE_GROUP_WINDOW_MS
      : false;
    const assistantInvolved =
      isAssistantHandle(message.authorHandle) || isAssistantHandle(last?.authorHandle ?? "");

    if (last && last.authorId === message.authorId && withinWindow && !assistantInvolved) {
      last.messages.push(message);
      continue;
    }
    last = {
      authorId: message.authorId,
      authorHandle: message.authorHandle,
      authorDisplayName: message.authorDisplayName,
      authorAvatarUrl: message.authorAvatarUrl,
      authorCountry: message.authorCountry,
      authorLevel: message.authorLevel,
      messages: [message],
    };
    items.push({ type: "group", key: message.id, group: last });
  }
  return items;
}
