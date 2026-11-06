export interface AssistantStream {
  invocationId: string;
  text: string;
  recorded: boolean;
}

/** Échec d'un appel à @kemet, montré à la seule personne qui l'a posé. */
export interface AssistantFailure {
  invocationId: string;
  /** Code envoyé par le serveur (`assistant_unavailable`, `quota_exceeded`…). */
  errorCode: string;
  triggerMessageId: string;
}

interface AssistantFailedEvent {
  invocationId: string;
  errorCode: string;
  requestedBy: string;
  triggerMessageId: string;
}

export function appendAssistantChunk(
  current: AssistantStream | null,
  event: { invocationId: string; delta: string; recorded: boolean },
): AssistantStream {
  if (current?.invocationId === event.invocationId) {
    return { ...current, text: current.text + event.delta };
  }
  return { invocationId: event.invocationId, text: event.delta, recorded: event.recorded };
}

/**
 * Une réponse qui échoue quitte le fil du salon, même commencée : un début de
 * réponse sans fin ne doit pas rester lu comme une réponse de @kemet.
 */
export function dropFailedStream(
  current: AssistantStream | null,
  event: { invocationId: string },
): AssistantStream | null {
  return current?.invocationId === event.invocationId ? null : current;
}

/**
 * Le salon entier reçoit l'échec : seule la personne qui a posé la question
 * le voit, puisque lui seul peut la reposer, et qu'un quota atteint ne
 * regarde qu'elle.
 */
export function failureForViewer(
  event: AssistantFailedEvent,
  viewerProfileId: string | null,
): AssistantFailure | null {
  if (viewerProfileId === null || event.requestedBy !== viewerProfileId) return null;
  return {
    invocationId: event.invocationId,
    errorCode: event.errorCode,
    triggerMessageId: event.triggerMessageId,
  };
}
