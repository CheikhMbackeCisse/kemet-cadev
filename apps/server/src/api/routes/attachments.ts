import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import {
  findAttachmentById,
  insertPendingAttachment,
  lockUserStorageQuota,
} from "../repositories/attachments.js";
import { findMessageById } from "../repositories/chat.js";
import { findProfileByUserId, isProfileDeleted } from "../repositories/profiles.js";
import { serializeAttachment } from "../chat-serializers.js";
import type { ChatAppDeps } from "../app.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { requireChannelAccess, requireWritableSpace } from "./channels.js";

const MAX_ATTACHMENTS_PER_MINUTE = 30;

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'envoyer un fichier.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

/** Sans guillemet ni caractère de contrôle : la valeur part dans un en-tête HTTP. */
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

export function registerAttachmentRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits, antiSpamConfig }: ChatAppDeps,
): void {
  app.post<{ Params: { id: string } }>(
    "/api/channels/:id/messages/attachments",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_ATTACHMENTS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { channel, space } = await requireChannelAccess(db, request.params.id, profile.id);
      requireWritableSpace(space);

      const part = await request.file();
      if (!part) throw badRequest("Aucun fichier envoyé.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        // @fastify/multipart lève FST_REQ_FILE_TOO_LARGE au-delà de `limits.fileSize`.
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest(
            `Le fichier dépasse la taille maximale autorisée (${attachmentLimits.maxAttachmentBytes} octets).`,
          );
        }
        throw error;
      }

      const detected = await detectAttachment(buffer, part.filename);
      if (!detected) throw badRequest("Ce type de fichier n'est pas autorisé.");

      const storageKey = randomUUID();
      const attachment = await db.transaction(async (tx) => {
        // Verrou avant la lecture du quota : sans lui, deux envois
        // concurrents du même utilisateur pourraient tous deux lire un
        // quota encore disponible avant que l'un des deux ne committe.
        await lockUserStorageQuota(tx, profile.id);
        const alreadyStored = await sumTotalUserStorageBytes(tx, profile.id);
        if (alreadyStored + buffer.length > attachmentLimits.maxUserStorageBytes) {
          throw badRequest("Quota de stockage de fichiers atteint.");
        }
        await storage.save(storageKey, buffer);
        return insertPendingAttachment(tx, {
          channelId: channel.id,
          authorId: profile.id,
          storageKey,
          kind: detected.kind,
          mimeType: detected.mimeType,
          originalName: sanitizeFilename(part.filename),
          byteSize: buffer.length,
        });
      });

      return { attachment: serializeAttachment(attachment) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/attachments/:id/content", async (request, reply) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await requireOwnProfile(db, userId);
    const attachment = await findAttachmentById(db, request.params.id);
    // Un fichier jamais rattaché à un message (composeur abandonné) n'est
    // jamais servi : il n'a pas encore passé le contrôle d'un vrai message.
    if (!attachment || !attachment.messageId) throw notFound("Ce fichier n'existe pas.");
    const message = await findMessageById(db, attachment.messageId);
    // Un message supprimé masque déjà ses pièces jointes côté client
    // (serializeMessage) ; sans ce contrôle, l'URL du fichier restait
    // joignable directement à qui l'avait conservée.
    if (!message || message.deletedAt) throw notFound("Ce fichier n'existe pas.");
    await requireChannelAccess(db, attachment.channelId, profile.id);
    // Effacé du disque avec le compte de son auteur (ADR 0023).
    if (await isProfileDeleted(db, attachment.authorId)) throw notFound("Ce fichier a été supprimé.");

    const disposition = attachment.kind === "image" ? "inline" : "attachment";
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'")
      .header("Content-Length", attachment.byteSize)
      .header("Content-Disposition", contentDisposition(disposition, attachment.originalName))
      .type(attachment.mimeType);
    return reply.send(storage.read(attachment.storageKey));
  });
}
