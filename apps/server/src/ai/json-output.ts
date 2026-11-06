import type { ZodType } from "zod";

/**
 * Lit l'objet JSON d'une réponse de modèle et le valide. Le texte autour est
 * toléré : sans sortie structurée, un modèle ajoute souvent une phrase ou un
 * bloc de code Markdown autour du JSON demandé. `null` si rien n'est valide.
 */
export function parseJsonOutput<T>(text: string, schema: ZodType<T>): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
