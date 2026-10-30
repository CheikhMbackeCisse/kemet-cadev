export { KEMET_HANDLE } from "@kemet/shared";

// Identité fixe créée par la migration 0003 (voir packages/db/migrations) :
// jamais connectable, aucun identifiant de compte ne lui correspond.
export const KEMET_ASSISTANT_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

const MENTION_PATTERN = /@kemet\b/i;
// Le "," qui suit le slug dans "@kemet avec wave-paiements, comment…" est une
// virgule de grammaire française, pas un séparateur de liste : un seul skill
// peut être demandé explicitement à la fois.
const MENTION_WITH_SKILL_PATTERN = /@kemet\s+avec\s+([a-z0-9][a-z0-9-]*)\s*,?\s*/i;

export function mentionsAssistant(body: string): boolean {
  return MENTION_PATTERN.test(body);
}

export interface AssistantRequest {
  question: string;
  requestedSlugs: string[];
}

/**
 * "@kemet avec wave-paiements, comment…" demande un skill précis ; une
 * simple mention laisse l'assistant choisir.
 */
export function parseAssistantRequest(body: string): AssistantRequest {
  const withSkill = body.match(MENTION_WITH_SKILL_PATTERN);
  if (withSkill) {
    const question = body.slice(withSkill.index! + withSkill[0].length).trim();
    return { question, requestedSlugs: [withSkill[1]!.toLowerCase()] };
  }
  const question = body.replace(MENTION_PATTERN, "").trim();
  return { question, requestedSlugs: [] };
}
