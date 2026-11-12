import { MAX_SKILL_CONTENT_LENGTH } from "@kemet/shared";

export const MAX_SKILL_FILE_BYTES = 100 * 1024;

export type SkillFileError = "tooLarge" | "notText" | "empty" | "contentTooLong";

export interface ParsedSkillFile {
  name: string | null;
  description: string | null;
  content: string;
}

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(["'])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2]! : trimmed;
}

/**
 * Lit les clés `name` et `description` d'un en-tête YAML simple, une par
 * ligne. Le reste de l'en-tête est ignoré : rien n'y est évalué.
 */
function readFrontMatter(block: string): Pick<ParsedSkillFile, "name" | "description"> {
  const fields: Pick<ParsedSkillFile, "name" | "description"> = { name: null, description: null };
  for (const line of block.split(/\r?\n/)) {
    const match = /^(name|description)[ \t]*:(.*)$/.exec(line);
    if (match) fields[match[1] as "name" | "description"] = unquote(match[2]!) || null;
  }
  return fields;
}

/** Découpe le texte d'un SKILL.md : en-tête facultatif, puis le contenu. */
export function parseSkillMarkdown(text: string): ParsedSkillFile {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const header = FRONT_MATTER.exec(source);
  if (!header) return { name: null, description: null, content: source.trim() };
  return { ...readFrontMatter(header[1]!), content: source.slice(header[0].length).trim() };
}

/**
 * Le type est jugé sur le contenu, pas sur l'extension : un fichier qui n'est
 * pas du texte UTF-8, ou qui contient un octet nul (image, PDF, archive
 * renommés), est refusé.
 */
export function decodeSkillFile(bytes: Uint8Array): ParsedSkillFile | SkillFileError {
  if (bytes.byteLength > MAX_SKILL_FILE_BYTES) return "tooLarge";
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "notText";
  }
  if (text.includes("\u0000")) return "notText";
  const parsed = parseSkillMarkdown(text);
  if (!parsed.content) return "empty";
  if (parsed.content.length > MAX_SKILL_CONTENT_LENGTH) return "contentTooLong";
  return parsed;
}

export async function readSkillFile(file: File): Promise<ParsedSkillFile | SkillFileError> {
  // La taille est vérifiée avant de lire : un gros fichier n'est jamais chargé.
  if (file.size > MAX_SKILL_FILE_BYTES) return "tooLarge";
  return decodeSkillFile(new Uint8Array(await file.arrayBuffer()));
}
