import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_SIDE_PX,
  AVATAR_MIME_TYPES,
  readImageSize,
} from "@kemet/shared";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { PUBLIC_FILE_CACHE } from "../../storage/cache-control.js";
import { MULTIPART_FIELD_LIMITS } from "../multipart-limits.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { avatarUrl, findAvatar, findAvatarByKey, upsertAvatar } from "../repositories/avatars.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import type { ChatAppDeps } from "../app.js";

const MAX_AVATAR_UPLOADS_PER_HOUR = 20;
const avatarKeyParamsSchema = z.object({ key: z.string().uuid() });

/**
 * Photo de profil : envoyée par la personne elle-même, servie à tous comme
 * l'adresse `profiles.avatar_url` qu'elle remplace. Type lu sur le contenu,
 * jamais sur le nom ni l'en-tête du fichier.
 */
export function registerAvatarRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits }: ChatAppDeps,
): void {
  app.put(
    "/api/me/avatar",
    { config: { rateLimit: { max: MAX_AVATAR_UPLOADS_PER_HOUR, timeWindow: "1 hour" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await findProfileByUserId(db, userId);
      if (!profile) throw badRequest("Complète ton profil avant d'ajouter une photo.");
      if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");

      const maxBytes = Math.min(AVATAR_MAX_BYTES, attachmentLimits.maxAttachmentBytes);
      const part = await request.file({
        limits: { fileSize: maxBytes, files: 1, ...MULTIPART_FIELD_LIMITS },
      });
      if (!part) throw badRequest("Aucune image envoyée.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest(`La photo dépasse ${Math.round(maxBytes / 1024 / 1024)} Mo.`);
        }
        throw error;
      }
      const detected = await fileTypeFromBuffer(buffer);
      if (!detected || !(AVATAR_MIME_TYPES as readonly string[]).includes(detected.mime)) {
        throw badRequest("La photo doit être une image PNG, JPEG ou WebP.");
      }
      // Un en-tête qui annonce une image démesurée ferait décoder des
      // centaines de mégaoctets à chaque navigateur qui l'affiche.
      const size = readImageSize(buffer, detected.mime);
      if (!size || size.width > AVATAR_MAX_SIDE_PX || size.height > AVATAR_MAX_SIDE_PX) {
        throw badRequest(`La photo doit mesurer au plus ${AVATAR_MAX_SIDE_PX} pixels de côté.`);
      }

      const storageKey = randomUUID();
      let saved = false;
      const previousKey = await db
        .transaction(async (tx) => {
          await lockUserStorageQuota(tx, profile.id);
          const previous = await findAvatar(tx, profile.id);
          const used = (await sumTotalUserStorageBytes(tx, profile.id)) - (previous?.byteSize ?? 0);
          if (used + buffer.length > attachmentLimits.maxUserStorageBytes) {
            throw badRequest("Quota de stockage de fichiers atteint.");
          }
          await storage.save(storageKey, buffer);
          saved = true;
          await upsertAvatar(tx, {
            profileId: profile.id,
            storageKey,
            mimeType: detected.mime,
            byteSize: buffer.length,
          });
          return previous?.storageKey ?? null;
        })
        // Aucun job de nettoyage ne couvre les photos : le nouveau fichier
        // d'une transaction annulée est effacé ici.
        .catch(async (error: unknown) => {
          if (saved) await storage.delete(storageKey);
          throw error;
        });
      // Après la validation seulement : une transaction annulée garde l'ancienne photo.
      // La nouvelle photo est enregistrée : un ancien fichier qui résiste ne
      // doit pas faire croire à un échec, il est seulement signalé.
      if (previousKey) {
        await storage.delete(previousKey).catch((error: unknown) => {
          request.log.warn({ err: error, storageKey: previousKey }, "ancienne photo non effacée");
        });
      }
      return { avatarUrl: avatarUrl(storageKey) };
    },
  );

  app.get<{ Params: { key: string } }>(
    "/api/avatars/:key",
    { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = avatarKeyParamsSchema.safeParse(request.params);
      if (!parsed.success) throw notFound("Cette photo n'existe pas.");
      const avatar = await findAvatarByKey(db, parsed.data.key);
      if (!avatar) throw notFound("Cette photo n'existe pas.");
      reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'")
        // La clé change à chaque envoi : une adresse ne désigne jamais deux images.
        .header("Cache-Control", PUBLIC_FILE_CACHE)
        .header("Content-Length", avatar.byteSize)
        .header("Content-Disposition", contentDisposition("inline", "photo"))
        .type(avatar.mimeType);
      return reply.send(storage.read(avatar.storageKey));
    },
  );
}
