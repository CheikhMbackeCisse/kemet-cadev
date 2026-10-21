import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { lockUserStorageQuota, sumUserStorageBytes } from "../repositories/attachments.js";
import {
  findPostAttachmentById,
  insertPendingPostAttachment,
  sumUserPostAttachmentBytes,
} from "../repositories/post-attachments.js";
import { findPostById } from "../repositories/posts.js";
import { findProfileByUserId } from "../repositories/profiles.js";
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
      const attachment = await db.transaction(async (tx) => {
        // Même verrou que pour les fichiers de salon : un seul quota de
        // stockage par utilisateur, fichiers de salon et images de post
        // confondus (voir docs/adr/0017-images-sur-les-posts.md).
        await lockUserStorageQuota(tx, profile.id);
        const alreadyStored =
          (await sumUserStorageBytes(tx, profile.id)) + (await sumUserPostAttachmentBytes(tx, profile.id));
        if (alreadyStored + buffer.length > attachmentLimits.maxUserStorageBytes) {
          throw badRequest("Quota de stockage de fichiers atteint.");
        }
        await storage.save(storageKey, buffer);
        return insertPendingPostAttachment(tx, {
          authorId: profile.id,
          storageKey,
          mimeType: detected.mimeType,
          originalName: sanitizeFilename(part.filename),
          byteSize: buffer.length,
        });
      });

      return { attachment: serializePostAttachment(attachment) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/post-attachments/:id/content", async (request, reply) => {
    const attachment = await findPostAttachmentById(db, request.params.id);
    // Une image jamais rattachée à un post (composeur abandonné) n'est
    // jamais servie, comme pour les fichiers de salon.
    if (!attachment || !attachment.postId) throw notFound("Cette image n'existe pas.");
    const post = await findPostById(db, attachment.postId);
    // Un post supprimé masque déjà ses images côté client (serializePostSummary) ;
    // sans ce contrôle, l'URL de l'image restait joignable directement à qui
    // l'avait conservée. Lecture publique (mode visiteur, lot 11a) : le fil
    // est lisible sans session, cette route l'est donc aussi.
    if (!post || post.deletedAt) throw notFound("Cette image n'existe pas.");

    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'")
      .header("Content-Length", attachment.byteSize)
      .header("Content-Disposition", `inline; filename="${attachment.originalName}"`)
      .type(attachment.mimeType);
    return reply.send(storage.read(attachment.storageKey));
  });
}
