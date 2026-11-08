import { z } from "zod";

export const MAX_WORK_GALLERY_IMAGES = 8;
/** Vidéos envoyées et liens YouTube confondus. */
export const MAX_WORK_VIDEOS = 3;
export const DEFAULT_MAX_WORK_VIDEO_BYTES = 50 * 1024 * 1024;

export const WORK_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const WORK_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

/**
 * Identifiant d'une vidéo YouTube (11 caractères) lu dans un lien
 * `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/` ou `/live/`.
 * Seul l'identifiant est gardé : la page construit elle-même l'adresse
 * youtube-nocookie, jamais à partir du lien donné.
 */
export function parseYoutubeId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    candidate = first === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(first ?? "") ? (second ?? null) : null;
  }
  return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
}

export const youtubeUrlSchema = z
  .string()
  .max(300)
  .transform((value, context) => {
    const id = parseYoutubeId(value);
    if (!id) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Ce lien n'est pas une vidéo YouTube." });
      return z.NEVER;
    }
    return id;
  });

export const workMediaRoleSchema = z.enum(["cover", "gallery", "video"]);
export type WorkMediaRole = z.infer<typeof workMediaRoleSchema>;

export const workMediaInputSchema = z.object({ id: z.string().uuid(), role: workMediaRoleSchema });
export type WorkMediaInput = z.infer<typeof workMediaInputSchema>;

/**
 * Médias envoyés, dans l'ordre d'affichage, et liens YouTube. Une seule
 * couverture, une galerie bornée, trois vidéos au plus en tout.
 */
export const workMediaFieldsSchema = z
  .object({
    media: z.array(workMediaInputSchema).max(1 + MAX_WORK_GALLERY_IMAGES + MAX_WORK_VIDEOS),
    youtubeUrls: z.array(youtubeUrlSchema).max(MAX_WORK_VIDEOS),
  })
  .superRefine((value, context) => {
    const count = (role: WorkMediaRole) => value.media.filter((item) => item.role === role).length;
    if (count("cover") > 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["media"], message: "Une seule image de couverture." });
    }
    if (count("gallery") > MAX_WORK_GALLERY_IMAGES) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: `${MAX_WORK_GALLERY_IMAGES} images au plus dans la galerie.`,
      });
    }
    if (count("video") + value.youtubeUrls.length > MAX_WORK_VIDEOS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["media"],
        message: `${MAX_WORK_VIDEOS} vidéos au plus, liens YouTube compris.`,
      });
    }
    if (new Set(value.media.map((item) => item.id)).size !== value.media.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["media"], message: "Un même fichier apparaît deux fois." });
    }
  });
export type WorkMediaFields = z.infer<typeof workMediaFieldsSchema>;

export const workUploadedMediaSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  mimeType: z.string(),
  originalName: z.string(),
  byteSize: z.number().int().nonnegative(),
});
export type WorkUploadedMedia = z.infer<typeof workUploadedMediaSchema>;

export const workImageSchema = z.object({ id: z.string().uuid(), originalName: z.string() });
export type WorkImage = z.infer<typeof workImageSchema>;

export const workVideoSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("file"), id: z.string().uuid(), mimeType: z.string(), originalName: z.string() }),
  z.object({ kind: z.literal("youtube"), id: z.string().uuid(), youtubeId: z.string() }),
]);
export type WorkVideo = z.infer<typeof workVideoSchema>;

/** Adresse publique d'une image ou d'une vidéo envoyée. */
export function workMediaContentPath(id: string): string {
  return `/api/work-media/${id}/content`;
}
