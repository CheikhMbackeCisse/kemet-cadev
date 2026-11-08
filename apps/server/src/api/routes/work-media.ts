import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import {
  DEFAULT_MAX_WORK_VIDEO_BYTES,
  WORK_IMAGE_MIME_TYPES,
  WORK_VIDEO_MIME_TYPES,
  type WorkMediaFields,
} from "@kemet/shared";
import type { Db, DbOrTx } from "@kemet/db";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { parseByteRange } from "../../storage/byte-range.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import { findWorkById } from "../repositories/works.js";
import {
  findAttachableWorkMedia,
  findWorkMediaById,
  insertPendingWorkMedia,
  replaceWorkMedia,
} from "../repositories/work-media.js";
import type { ChatAppDeps } from "../app.js";

const mediaParamsSchema = z.object({ id: z.string().uuid() });

const MAX_WORK_MEDIA_UPLOADS_PER_MINUTE = 20;

type DetectedMedia = { kind: "image" | "video"; mimeType: string };

/** Type d'après le contenu du fichier, jamais d'après son nom ou l'en-tête du client. */
async function detectWorkMedia(data: Buffer): Promise<DetectedMedia | null> {
  const sniffed = await fileTypeFromBuffer(data);
  if (!sniffed) return null;
  if ((WORK_IMAGE_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    return { kind: "image", mimeType: sniffed.mime };
  }
  if ((WORK_VIDEO_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    return { kind: "video", mimeType: sniffed.mime };
  }
  return null;
}

function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

/**
 * Pose les médias d'un travail : chaque fichier doit avoir été envoyé par
 * `authorId`, être encore libre ou déjà sur ce travail, et son type doit
 * correspondre à son rôle (une image en couverture ou en galerie, une vidéo
 * en vidéo).
 */
export async function applyWorkMedia(tx: DbOrTx, workId: string, authorId: string, fields: WorkMediaFields) {
  const rows = await findAttachableWorkMedia(
    tx,
    fields.media.map((item) => item.id),
    authorId,
    workId,
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const item of fields.media) {
    const row = byId.get(item.id);
    if (!row) throw badRequest("Un des fichiers envoyés n'est plus disponible pour ce travail.");
    const expected = item.role === "video" ? "video" : "image";
    if (row.kind !== expected) {
      throw badRequest(
        expected === "video"
          ? "Seule une vidéo peut être ajoutée comme vidéo."
          : "Seule une image peut servir de couverture ou d'image de galerie.",
      );
    }
  }
  await replaceWorkMedia(tx, workId, authorId, fields.media, fields.youtubeUrls);
}

async function requireUploader(db: Db, userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier un travail.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

export function registerWorkMediaRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits, antiSpamConfig }: ChatAppDeps,
): void {
  const maxVideoBytes = attachmentLimits.maxWorkVideoBytes ?? DEFAULT_MAX_WORK_VIDEO_BYTES;
  const maxImageBytes = attachmentLimits.maxAttachmentBytes;

  app.post(
    "/api/works/media",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_WORK_MEDIA_UPLOADS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireUploader(db, userId);
      // Plafond global du greffon multipart relevé pour cette seule route :
      // la limite propre à chaque type est vérifiée une fois le type connu.
      const part = await request.file({ limits: { fileSize: Math.max(maxVideoBytes, maxImageBytes), files: 1 } });
      if (!part) throw badRequest("Aucun fichier envoyé.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest("Le fichier dépasse la taille maximale autorisée.");
        }
        throw error;
      }
      const detected = await detectWorkMedia(buffer);
      if (!detected) throw badRequest("Seules les images (PNG, JPEG, WebP, GIF) et les vidéos MP4 ou WebM sont acceptées.");
      const limit = detected.kind === "video" ? maxVideoBytes : maxImageBytes;
      if (buffer.length > limit) {
        throw badRequest(
          detected.kind === "video"
            ? `La vidéo dépasse la taille maximale (${Math.round(limit / (1024 * 1024))} Mo).`
            : `L'image dépasse la taille maximale (${Math.round(limit / (1024 * 1024))} Mo).`,
        );
      }

      const storageKey = randomUUID();
      const media = await db.transaction(async (tx) => {
        await lockUserStorageQuota(tx, profile.id);
        if ((await sumTotalUserStorageBytes(tx, profile.id)) + buffer.length > attachmentLimits.maxUserStorageBytes) {
          throw badRequest("Quota de stockage de fichiers atteint.");
        }
        await storage.save(storageKey, buffer);
        return insertPendingWorkMedia(tx, {
          authorId: profile.id,
          kind: detected.kind,
          storageKey,
          mimeType: detected.mimeType,
          originalName: sanitizeFilename(part.filename),
          byteSize: buffer.length,
        });
      });
      return {
        media: {
          id: media.id,
          kind: detected.kind,
          mimeType: detected.mimeType,
          originalName: media.originalName ?? "",
          byteSize: media.byteSize,
        },
      };
    },
  );

  // Publique comme la page du travail, affichée dans la page : seuls des
  // types d'image et de vidéo vérifiés sur le contenu arrivent ici, servis
  // avec le type détecté à l'envoi et sans interprétation possible (nosniff,
  // CSP vide). Les requêtes partielles permettent au lecteur vidéo du
  // navigateur d'avancer dans la vidéo sans tout télécharger.
  app.get<{ Params: { id: string } }>("/api/work-media/:id/content", async (request, reply) => {
    const { id } = mediaParamsSchema.parse(request.params);
    const media = await findWorkMediaById(db, id);
    if (!media?.workId || !media.storageKey || !media.mimeType) throw notFound("Ce fichier n'existe pas.");
    const work = await findWorkById(db, media.workId);
    if (!work || work.deletedAt) throw notFound("Ce fichier n'existe pas.");

    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'")
      .header("Accept-Ranges", "bytes")
      .header("Content-Disposition", contentDisposition("inline", media.originalName ?? "media"))
      .type(media.mimeType);

    const range = parseByteRange(request.headers.range, media.byteSize);
    if (range === "unsatisfiable") {
      return reply.code(416).header("Content-Range", `bytes */${media.byteSize}`).send();
    }
    if (range) {
      return reply
        .code(206)
        .header("Content-Range", `bytes ${range.start}-${range.end}/${media.byteSize}`)
        .header("Content-Length", range.end - range.start + 1)
        .send(storage.read(media.storageKey, range));
    }
    return reply.header("Content-Length", media.byteSize).send(storage.read(media.storageKey));
  });
}
