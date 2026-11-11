const NOTICE_SEEN_KEY = "kemet:assistant-notice-seen";

/** Même règle que `mentionsAssistant` côté serveur : `@kocc`, ou l'ancien `@kemet`, seuls. */
const MENTION_PATTERN = /@(?:kocc|kemet)(?![a-z0-9-])/i;

export function mentionsAssistant(body: string): boolean {
  return MENTION_PATTERN.test(body);
}

/**
 * La mention de l'envoi vers Google, Groq ou OpenRouter s'affiche jusqu'au premier
 * appel envoyé, puis plus jamais sur ce navigateur.
 */
export function shouldShowAssistantNotice(draft: string): boolean {
  return mentionsAssistant(draft) && localStorage.getItem(NOTICE_SEEN_KEY) === null;
}

export function markAssistantNoticeSeen(): void {
  localStorage.setItem(NOTICE_SEEN_KEY, "1");
}
