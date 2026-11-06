import { handleSchema, MAX_CONVERSATION_MEMBERS, type Conversation } from "@kemet/shared";
import { fr } from "../../i18n/fr.js";

const NAMES_IN_TITLE = 3;
const EXCERPT_LENGTH = 80;

/** Le nom de l'autre personne, ou les premiers noms d'un groupe. */
export function conversationTitle(conversation: Pick<Conversation, "participants">): string {
  const names = conversation.participants.map((participant) => participant.displayName);
  if (names.length === 0) return fr.messages.alone;
  return fr.messages.groupOf(names.slice(0, NAMES_IN_TITLE), Math.max(0, names.length - NAMES_IN_TITLE));
}

/** Aperçu du dernier message dans la liste, préfixé de "Toi" quand on l'a écrit. */
export function conversationExcerpt(conversation: Conversation, viewerId: string | null): string {
  const last = conversation.lastMessage;
  if (!last) return fr.messages.noMessageYet;
  const text = last.deleted
    ? fr.messages.deletedMessage
    : last.body.trim()
      ? last.body.replace(/\s+/g, " ").trim()
      : last.hasAttachments
        ? fr.messages.attachmentOnly
        : "";
  const short = text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
  return last.authorId === viewerId ? `${fr.messages.you} : ${short}` : short;
}

/** Personne en face n'a encore accepté : la conversation est une demande envoyée. */
export function isAwaitingAcceptance(conversation: Pick<Conversation, "participants">): boolean {
  return (
    conversation.participants.length > 0 &&
    conversation.participants.every((participant) => participant.status === "pending")
  );
}

/** Heure pour un message du jour, date courte sinon. */
export function formatConversationTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export type ParsedHandles = { ok: true; handles: string[] } | { ok: false; error: string };

/** Identifiants saisis à la main, séparés par des virgules, des espaces ou des retours à la ligne. */
export function parseHandles(input: string): ParsedHandles {
  const handles = [
    ...new Set(
      input
        .split(/[\s,;]+/)
        .map((handle) => handle.trim().replace(/^@/, "").toLowerCase())
        .filter(Boolean),
    ),
  ];
  const invalid = handles.find((handle) => !handleSchema.safeParse(handle).success);
  if (invalid) return { ok: false, error: fr.messages.handlesInvalid(invalid) };
  if (handles.length > MAX_CONVERSATION_MEMBERS - 1) {
    return { ok: false, error: fr.messages.handlesTooMany(MAX_CONVERSATION_MEMBERS - 1) };
  }
  return { ok: true, handles };
}
