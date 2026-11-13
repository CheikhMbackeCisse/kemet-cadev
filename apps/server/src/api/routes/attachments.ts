import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { VOICE_MAX_BYTES, voiceDurationSchema } from "@kemet/shared";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import { requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound } from "../../errors.js";
import { PRIVATE_FILE_CACHE } from "../../storage/cache-control.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { detectVoice } from "../../storage/detect-voice.js";
import { parseByteRange } from "../../storage/byte-range.js";
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
import { MULTIPART_FIELD_LIMITS } from "../multipart-limits.js";
import { requireChannelAccess, requireChannelWriteAccess } from "./channels.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

const MAX_ATTACHMENTS_PER_MINUTE = 30;
// Un message vocal dure jusqu'à deux minutes : dix par minute laissent
// recommencer un enregistrement raté sans permettre d'inonder un salon.
const MAX_VOICE_MESSAGES_PER_MINUTE = 10;
const VOICE_FILE_NAMES = {
  "audio/webm": "message-vocal.webm",
  "audio/mp4": "message-vocal.m4a",
  "audio/ogg": "message-vocal.ogg",
} as const;

type PendingAttachmentInput = Omit<Parameters<typeof insertPendingAttachment>[1], "storageKey" | "byteSize">;

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

function parseId(params: unknown): string {
  const parsed = idParamsSchema.safeParse(params);
  if (!parsed.success) throw notFound("Ce salon n'existe pas.");
  return parsed.data.id;
}

function tooLarge(maxBytes: number) {
  return badRequest(`Le fichier dépasse la taille maximale autorisée (${maxBytes} octets).`);
}

async function readUploadedFile(part: { toBuffer: () => Promise<Buffer> }, maxBytes: number): Promise<Buffer> {
  try {
    return await part.toBuffer();
  } catch (error) {
    // @fastify/multipart lève FST_REQ_FILE_TOO_LARGE au-delà de `limits.fileSize`.
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") throw tooLarge(maxBytes);
    throw error;
  }
}

/** Écrit le fichier et sa ligne en attente, dans la limite du quota de stockage. */
async function storePendingAttachment(
  { db, storage, attachmentLimits }: Pick<ChatAppDeps, "db" | "storage" | "attachmentLimits">,
  buffer: Buffer,
  input: PendingAttachmentInput,
) {
  const storageKey = randomUUID();
  return db.transaction(async (tx) => {
    // Verrou avant la lecture du quota : sans lui, deux envois
    // concurrents du même utilisateur pourraient tous deux lire un
    // quota encore disponible avant que l'un des deux ne committe.
    await lockUserStorageQuota(tx, input.authorId);
    const alreadyStored = await sumTotalUserStorageBytes(tx, input.authorId);
    if (alreadyStored + buffer.length > attachmentLimits.maxUserStorageBytes) {
      throw badRequest("Quota de stockage de fichiers atteint.");
    }
    await storage.save(storageKey, buffer);
    return insertPendingAttachment(tx, { ...input, storageKey, byteSize: buffer.length });
  });
}

export function registerAttachmentRoutes(app: FastifyInstance, deps: ChatAppDeps): void {
  const { db, auth, storage, attachmentLimits, antiSpamConfig } = deps;

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
      const { channel } = await requireChannelWriteAccess(db, parseId(request.params), profile.id);

      const part = await request.file();
      if (!part) throw badRequest("Aucun fichier envoyé.");
      const buffer = await readUploadedFile(part, attachmentLimits.maxAttachmentBytes);

      const detected = await detectAttachment(buffer, part.filename);
      if (!detected) throw badRequest("Ce type de fichier n'est pas autorisé.");

      const attachment = await storePendingAttachment(deps, buffer, {
        channelId: channel.id,
        authorId: profile.id,
        kind: detected.kind,
        mimeType: detected.mimeType,
        originalName: sanitizeFilename(part.filename),
      });
      return { attachment: serializeAttachment(attachment) };
    },
  );

  // Message vocal, dans un salon comme dans une conversation privée : mêmes
  // droits d'écriture qu'un fichier. Gardé tel que le navigateur l'a
  // enregistré, sans conversion ; le type vient du contenu, qui ne doit
  // porter que de l'audio. La durée, annoncée par le client, ne sert qu'à
  // l'affichage, mais reste bornée à deux minutes.
  app.post<{ Params: { id: string } }>(
    "/api/channels/:id/messages/voice",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_VOICE_MESSAGES_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const { channel } = await requireChannelWriteAccess(db, parseId(request.params), profile.id);

      const part = await request.file({ limits: { fileSize: VOICE_MAX_BYTES, files: 1, ...MULTIPART_FIELD_LIMITS } });
      if (!part) throw badRequest("Aucun enregistrement envoyé.");
      const buffer = await readUploadedFile(part, VOICE_MAX_BYTES);

      // Le champ précède le fichier dans le formulaire : il est déjà lu ici.
      const field = part.fields.durationMs;
      const rawDuration = field && !Array.isArray(field) && field.type === "field" ? field.value : undefined;
      const duration = voiceDurationSchema.safeParse(rawDuration);
      if (!duration.success) throw badRequest("Durée de l'enregistrement invalide (deux minutes au plus).");

      const detected = await detectVoice(buffer);
      if (!detected) throw badRequest("Cet enregistrement n'est pas un fichier audio accepté.");

      const attachment = await storePendingAttachment(deps, buffer, {
        channelId: channel.id,
        authorId: profile.id,
        kind: "voice",
        mimeType: detected.mimeType,
        originalName: VOICE_FILE_NAMES[detected.mimeType],
        durationMs: duration.data,
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

    const disposition = attachment.kind === "image" || attachment.kind === "voice" ? "inline" : "attachment";
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'")
      .header("Cache-Control", PRIVATE_FILE_CACHE)
      .header("Content-Disposition", contentDisposition(disposition, attachment.originalName))
      .type(attachment.mimeType);
    if (attachment.kind !== "voice") {
      return reply.header("Content-Length", attachment.byteSize).send(storage.read(attachment.storageKey));
    }

    // Safari ne lit un fichier audio que servi par plages ; les autres
    // navigateurs s'en servent pour avancer dans l'enregistrement.
    reply.header("Accept-Ranges", "bytes");
    const range = parseByteRange(request.headers.range, attachment.byteSize);
    if (range === "unsatisfiable") {
      return reply.code(416).header("Cache-Control", "no-store").header("Content-Range", `bytes */${attachment.byteSize}`).send();
    }
    if (range) {
      return reply
        .code(206)
        .header("Content-Range", `bytes ${range.start}-${range.end}/${attachment.byteSize}`)
        .header("Content-Length", range.end - range.start + 1)
        .send(storage.read(attachment.storageKey, range));
    }
    return reply.header("Content-Length", attachment.byteSize).send(storage.read(attachment.storageKey));
  });
}
