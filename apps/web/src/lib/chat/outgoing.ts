import { ChatApiError } from "./api.js";

/** Un message affiché avant la réponse du serveur, jusqu'à son retour. */
export interface OutgoingMessage {
  clientId: string;
  body: string;
  parentMessageId: string | null;
  attachmentIds: string[];
  status: "sending" | "failed";
  /** Rempli quand le serveur a répondu par un refus : on affiche sa raison. */
  failure?: { message: string; retryable: boolean };
}

export function addOutgoing(list: OutgoingMessage[], message: OutgoingMessage): OutgoingMessage[] {
  return [...list.filter((item) => item.clientId !== message.clientId), message];
}

export function setOutgoingStatus(
  list: OutgoingMessage[],
  clientId: string,
  status: OutgoingMessage["status"],
  failure?: OutgoingMessage["failure"],
): OutgoingMessage[] {
  return list.map((item) => (item.clientId === clientId ? { ...item, status, failure } : item));
}

/**
 * Sans réponse du serveur, c'est la connexion. Un refus (compte suspendu,
 * message invalide) ne passera pas mieux au second essai ; une limite de
 * débit, si.
 */
export function describeSendFailure(error: unknown): OutgoingMessage["failure"] {
  if (!(error instanceof ChatApiError)) return undefined;
  const { statusCode } = error;
  return { message: error.message, retryable: statusCode === 429 || statusCode >= 500 };
}

export function removeOutgoing(list: OutgoingMessage[], clientId: string): OutgoingMessage[] {
  return list.filter((item) => item.clientId !== clientId);
}
