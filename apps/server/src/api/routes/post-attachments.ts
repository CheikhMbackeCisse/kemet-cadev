import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { readImageSize } from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { PUBLIC_FILE_CACHE } from "../../storage/cache-control.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { parseByteRange } from "../../storage/byte-range.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import {
  findPostAttachmentById,
  insertPendingPostAttachment,
} from "../repositories/post-attachments.js";
import { findPostById } from "../repositories/posts.js";
import { findProfileByUserId, isProfileDeleted } from "../repositories/profiles.js";
import { serializePostAttachment } from "../post-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";

const MAX_POST_ATTACHMENTS_PER_MINUTE = 20;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'envoyer une image.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

/** Sans guillemet ni caractère de contrôle : la valeur part dans un en-tête HTTP. */
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

export function registerPostAttachmentRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits, antiSpamConfig }: ChatAppDeps,
): void {
  app.post(
    "/api/posts/attachments",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_POST_ATTACHMENTS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);

      const part = await request.file();
      if (!part) throw badRequest("Aucune image envoyée.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest(
            `L'image dépasse la taille maximale autorisée (${attachmentLimits.maxAttachmentBytes} octets).`,
          );
        }
        throw error;
      }

      const detected = await detectAttachment(buffer, part.filename);
      if (!detected || detected.kind !== "image") {
        throw badRequest("Seules les images sont acceptées sur un post.");
      }

      const storageKey = randomUUID();
      let saved = false;
      const attachment = await db
        .transaction(async (tx) => {
          // Même verrou que les fichiers de salon : un seul quota par utilisateur.
          await lockUserStorageQuota(tx, profile.id);
          const alreadyStored = await sumTotalUserStorageBytes(tx, profile.id);
          if (alreadyStored + buffer.length > attachmentLimits.maxUserStorageBytes) {
            throw badRequest("Quota de stockage de fichiers atteint.");
          }
          await storage.save(storageKey, buffer);
          saved = true;
          return insertPendingPostAttachment(tx, {
            authorId: profile.id,
            storageKey,
            mimeType: detected.mimeType,
            originalName: sanitizeFilename(part.filename),
            byteSize: buffer.length,
            ...(readImageSize(buffer, detected.mimeType) ?? { width: null, height: null }),
          });
        })
        // Sans ligne en base, ni le quota ni le nettoyage des orphelins ne
        // verraient ce fichier.
        .catch(async (error: unknown) => {
          if (saved) await storage.delete(storageKey);
          throw error;
        });

      return { attachment: serializePostAttachment(attachment) };
    },
  );

  const attachmentParamsSchema = z.object({ id: z.string().uuid() });

  async function findServable(params: unknown) {
    const { id } = attachmentParamsSchema.parse(params);
    const attachment = await findPostAttachmentById(db, id);
    // Un fichier jamais rattaché à un post (composeur abandonné) n'est
    // jamais servi, comme pour les fichiers de salon.
    if (!attachment || !attachment.postId) throw notFound("Ce fichier n'existe pas.");
    const post = await findPostById(db, attachment.postId);
    // Sans ce contrôle, le fichier d'un post supprimé resterait joignable par
    // son URL. Route publique, comme le fil.
    if (!post || post.deletedAt) throw notFound("Ce fichier n'existe pas.");
    if (await isProfileDeleted(db, attachment.authorId))
      throw notFound("Ce fichier a été supprimé.");
    return attachment;
  }

  // Seuls des types d'image et de vidéo vérifiés sur le contenu arrivent ici,
  // servis avec le type détecté à l'envoi et sans interprétation possible
  // (nosniff, CSP vide). Les requêtes partielles laissent le lecteur vidéo
  // avancer sans tout télécharger, et reprendre une lecture coupée.
  app.get<{ Params: { id: string } }>(
    "/api/post-attachments/:id/content",
    async (request, reply) => {
      const attachment = await findServable(request.params);
      reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'")
        .header("Cache-Control", PUBLIC_FILE_CACHE)
        .header("Accept-Ranges", "bytes")
        .header("Content-Disposition", contentDisposition("inline", attachment.originalName))
        .type(attachment.mimeType);

      const range = parseByteRange(request.headers.range, attachment.byteSize);
      if (range === "unsatisfiable") {
        return reply
          .code(416)
          .header("Cache-Control", "no-store")
          .header("Content-Range", `bytes */${attachment.byteSize}`)
          .send();
      }
      if (range) {
        return reply
          .code(206)
          .header("Content-Range", `bytes ${range.start}-${range.end}/${attachment.byteSize}`)
          .header("Content-Length", range.end - range.start + 1)
          .send(storage.read(attachment.storageKey, range));
      }
      return reply
        .header("Content-Length", attachment.byteSize)
        .send(storage.read(attachment.storageKey));
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/post-attachments/:id/poster",
    async (request, reply) => {
      const attachment = await findServable(request.params);
      if (
        !attachment.posterStorageKey ||
        !attachment.posterMimeType ||
        attachment.posterByteSize === null
      ) {
        throw notFound("Cette vidéo n'a pas d'image d'aperçu.");
      }
      reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'")
        .header("Cache-Control", PUBLIC_FILE_CACHE)
        .header("Content-Length", attachment.posterByteSize)
        .header("Content-Disposition", contentDisposition("inline", "apercu"))
        .type(attachment.posterMimeType);
      return reply.send(storage.read(attachment.posterStorageKey));
    },
  );
}
