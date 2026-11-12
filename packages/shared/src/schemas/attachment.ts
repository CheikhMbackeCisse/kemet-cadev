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

/** Message vocal : deux minutes au plus, enregistrées par le navigateur. */
export const VOICE_MAX_DURATION_MS = 2 * 60 * 1000;
/**
 * Deux minutes d'Opus ou d'AAC à 32 kbit/s pèsent environ 500 ko ; la marge
 * couvre un navigateur qui ignore le débit demandé.
 */
export const VOICE_MAX_BYTES = 4 * 1024 * 1024;

export const voiceDurationSchema = z.coerce.number().int().min(1).max(VOICE_MAX_DURATION_MS);

export const attachmentKindSchema = z.enum(["image", "file", "voice"]);

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  kind: attachmentKindSchema,
  mimeType: z.string(),
  originalName: z.string(),
  byteSize: z.number().int().nonnegative(),
  /** Durée d'un message vocal, nulle pour tout autre fichier. */
  durationMs: z.number().int().nullable(),
  /** Image d'un post : dimensions lues à l'envoi, pour réserver le cadre. */
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  createdAt: z.string().datetime(),
  // Fichier effacé du disque avec le compte de son auteur : la ligne reste
  // pour afficher "Fichier supprimé" plutôt qu'un lien cassé.
  removed: z.boolean(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
