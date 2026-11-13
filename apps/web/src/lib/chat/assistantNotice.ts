/** Même règle que `mentionsAssistant` côté serveur : `@kocc`, ou l'ancien `@kemet`, seuls. */
const MENTION_PATTERN = /@(?:kocc|kemet)(?![a-z0-9-])/i;

export function mentionsAssistant(body: string): boolean {
  return MENTION_PATTERN.test(body);
}
