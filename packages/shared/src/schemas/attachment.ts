import { z } from "zod";

export const ATTACHMENT_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/**
 * Types proposés en téléchargement, jamais affichés en page. Le SVG en fait
 * partie : il peut contenir du script.
 */
export const ATTACHMENT_FILE_MIME_TYPES = ["application/pdf", "application/zip", "image/svg+xml", "text/plain"] as const;

/**
 * Extensions de texte ou de code acceptées quand le contenu ne porte pas de
 * signature binaire détectable (voir isTextAttachment côté serveur). La
 * vérification porte alors sur le contenu (UTF-8 valide, pas d'octet nul),
 * pas sur l'extension seule.
 */
export const ATTACHMENT_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".html",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".sh",
] as const;

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_POST_ATTACHMENTS = 4;

export const attachmentKindSchema = z.enum(["image", "file"]);

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  kind: attachmentKindSchema,
  mimeType: z.string(),
  originalName: z.string(),
  byteSize: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
