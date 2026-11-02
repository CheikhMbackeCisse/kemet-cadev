const NOTICE_SEEN_KEY = "kemet:assistant-notice-seen";

/** Même règle que `mentionsAssistant` côté serveur : `@kemetien` n'appelle pas l'assistant. */
const MENTION_PATTERN = /@kemet\b/i;

export function mentionsAssistant(body: string): boolean {
  return MENTION_PATTERN.test(body);
}

/**
 * La mention de l'envoi vers Google ou OpenRouter s'affiche jusqu'au premier
 * appel envoyé, puis plus jamais sur ce navigateur.
 */
export function shouldShowAssistantNotice(draft: string): boolean {
  return mentionsAssistant(draft) && localStorage.getItem(NOTICE_SEEN_KEY) === null;
}

export function markAssistantNoticeSeen(): void {
  localStorage.setItem(NOTICE_SEEN_KEY, "1");
}
