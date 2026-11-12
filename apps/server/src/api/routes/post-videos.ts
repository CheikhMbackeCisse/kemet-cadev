import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import {
  POST_VIDEO_MAX_BYTES,
  POST_VIDEO_MAX_DURATION_MS,
  POST_VIDEO_MIME_TYPES,
  POST_VIDEO_POSTER_MAX_BYTES,
  POST_VIDEO_POSTER_MAX_SIDE,
  readImageSize,
  type PostVideoMimeType,
} from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden } from "../../errors.js";
import { inspectVideo } from "../../storage/inspect-video.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import { insertPendingPostAttachment } from "../repositories/post-attachments.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { serializePostAttachment } from "../post-serializers.js";
import type { ChatAppDeps } from "../app.js";

// Un compte de moins de 24 h en garde trois (facteur anti-spam) : de quoi corriger un envoi refusé.
const MAX_POST_VIDEOS_PER_MINUTE = 12;
const POSTER_MIME_TYPES = ["image/jpeg", "image/webp", "image/png"];

/** Sans guillemet ni caractère de contrôle : la valeur part dans un en-tête HTTP. */
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

async function readParts(request: FastifyRequest) {
  const files: Partial<Record<"video" | "poster", { buffer: Buffer; filename: string }>> = {};
  // Deux fichiers nommés, rien d'autre : la vidéo et son image d'aperçu.
  const parts = request.files({
    limits: { fileSize: POST_VIDEO_MAX_BYTES, files: 2, fields: 0, parts: 2, fieldSize: 64 },
  });
  try {
    for await (const part of parts) {
      if (part.fieldname !== "video" && part.fieldname !== "poster") {
        throw badRequest("Champ inattendu dans l'envoi.");
      }
      files[part.fieldname] = { buffer: await part.toBuffer(), filename: part.filename };
    }
  } catch (error) {
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw badRequest(`La vidéo dépasse ${POST_VIDEO_MAX_BYTES / (1024 * 1024)} Mo.`);
    }
    throw error;
  }
  return files;
}

/**
 * Vidéo d'un post, envoyée telle quelle avec l'image d'aperçu que le
 * navigateur en a tirée. Le serveur ne la convertit pas et n'en décode
 * aucune image : il vérifie le type sur le contenu, la présence d'une piste
 * vidéo et la durée annoncée par le conteneur.
 */
export function registerPostVideoRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits, antiSpamConfig }: ChatAppDeps,
): void {
  app.post(
    "/api/posts/videos",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_POST_VIDEOS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw badRequest("Complétez votre profil avant d'envoyer une vidéo.");
      if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");

      const { video, poster } = await readParts(request);
      if (!video) throw badRequest("Aucune vidéo envoyée.");
      if (!poster) throw badRequest("L'image d'aperçu de la vidéo manque.");

      const sniffed = await fileTypeFromBuffer(video.buffer);
      const mimeType = sniffed?.mime as PostVideoMimeType | undefined;
      if (!mimeType || !(POST_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) {
        throw badRequest("Seules les vidéos MP4 ou WebM sont acceptées.");
      }
      const info = inspectVideo(video.buffer, mimeType);
      if (!info.hasVideoTrack) throw badRequest("Ce fichier ne contient pas d'image vidéo.");
      const durationMs = info.durationMs;
      if (durationMs === null) throw badRequest("La durée de cette vidéo est illisible.");
      if (durationMs > POST_VIDEO_MAX_DURATION_MS) {
        throw badRequest(`La vidéo dépasse ${POST_VIDEO_MAX_DURATION_MS / 1000} secondes.`);
      }

      if (poster.buffer.length > POST_VIDEO_POSTER_MAX_BYTES) throw badRequest("L'image d'aperçu est trop lourde.");
      const posterType = await fileTypeFromBuffer(poster.buffer);
      const size = posterType && POSTER_MIME_TYPES.includes(posterType.mime) && readImageSize(poster.buffer, posterType.mime);
      if (!posterType || !size) throw badRequest("L'image d'aperçu n'est pas une image valide.");
      if (Math.max(size.width, size.height) > POST_VIDEO_POSTER_MAX_SIDE) {
        throw badRequest("L'image d'aperçu est trop grande.");
      }

      const storageKey = randomUUID();
      const posterStorageKey = randomUUID();
      const total = video.buffer.length + poster.buffer.length;
      const saved: string[] = [];
      const attachment = await db
        .transaction(async (tx) => {
          await lockUserStorageQuota(tx, profile.id);
          if ((await sumTotalUserStorageBytes(tx, profile.id)) + total > attachmentLimits.maxUserStorageBytes) {
            throw badRequest("Quota de stockage de fichiers atteint.");
          }
          await storage.save(storageKey, video.buffer);
          saved.push(storageKey);
          await storage.save(posterStorageKey, poster.buffer);
          saved.push(posterStorageKey);
          return insertPendingPostAttachment(tx, {
            authorId: profile.id,
            storageKey,
            mimeType,
            originalName: sanitizeFilename(video.filename),
            byteSize: video.buffer.length,
            width: size.width,
            height: size.height,
            durationMs,
            posterStorageKey,
            posterMimeType: posterType.mime,
            posterByteSize: poster.buffer.length,
          });
        })
        // Sans ligne en base, le nettoyage des orphelins ne verrait jamais ces fichiers.
        .catch(async (error: unknown) => {
          await Promise.all(saved.map((key) => storage.delete(key)));
          throw error;
        });

      return { attachment: serializePostAttachment(attachment) };
    },
  );
}
