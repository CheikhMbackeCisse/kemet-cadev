import { fileTypeFromBuffer } from "file-type";
import {
  ATTACHMENT_FILE_MIME_TYPES,
  ATTACHMENT_IMAGE_MIME_TYPES,
  ATTACHMENT_TEXT_EXTENSIONS,
  type Attachment,
} from "@kemet/shared";

export interface DetectedAttachment {
  kind: Attachment["kind"];
  mimeType: string;
}

function hasTextExtension(originalName: string): boolean {
  const lower = originalName.toLowerCase();
  return ATTACHMENT_TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Un fichier texte n'a pas de signature : accepté seulement en UTF-8 valide
 * sans octet nul et avec une extension de la liste blanche. Seul cas où
 * l'extension compte.
 */
function isPlainText(data: Buffer): boolean {
  if (data.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

const SVG_ROOT_TAG_PATTERN = /<svg[\s>]/i;

/**
 * file-type ne détecte délibérément pas le SVG (pas de signature binaire,
 * juste du XML) : on cherche sa balise racine dans le texte décodé. Ce test
 * porte uniquement sur le contenu, jamais sur l'extension `.svg`.
 */
function isSvg(text: string): boolean {
  return SVG_ROOT_TAG_PATTERN.test(text.slice(0, 4096));
}

/**
 * Type réel d'un fichier d'après son contenu, jamais d'après l'extension ou
 * le Content-Type du client (sauf pour le texte, voir plus haut). `null` si
 * le type n'est pas autorisé.
 */
export async function detectAttachment(data: Buffer, originalName: string): Promise<DetectedAttachment | null> {
  const sniffed = await fileTypeFromBuffer(data);

  if (sniffed) {
    if ((ATTACHMENT_IMAGE_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
      return { kind: "image", mimeType: sniffed.mime };
    }
    if ((ATTACHMENT_FILE_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
      return { kind: "file", mimeType: sniffed.mime };
    }
    // file-type sniffe un SVG comme de l'XML générique (`application/xml`),
    // faute de signature binaire propre au SVG : on vérifie nous-mêmes avant
    // de refuser, plutôt que de se fier à cette classification trop large.
    if (isPlainText(data) && isSvg(new TextDecoder("utf-8").decode(data))) {
      return { kind: "file", mimeType: "image/svg+xml" };
    }
    return null;
  }

  if (!isPlainText(data)) return null;
  const text = new TextDecoder("utf-8").decode(data);
  if (isSvg(text)) return { kind: "file", mimeType: "image/svg+xml" };
  if (hasTextExtension(originalName)) return { kind: "file", mimeType: "text/plain" };
  return null;
}
