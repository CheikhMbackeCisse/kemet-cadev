import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { MAX_CV_BYTES, updateCvSchema, type Cv } from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../errors.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { MULTIPART_FIELD_LIMITS } from "../multipart-limits.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import {
  countOpenHelpRequests,
  FEED_PROJECT_ROLES,
  listOpenRoles,
} from "../repositories/projects.js";
import { findAuthorProfile, getSkillStats } from "../repositories/skills.js";
import { findProfileByHandle, findProfileByUserId } from "../repositories/profiles.js";
import {
  deleteCv,
  findCv,
  listOwnedProjects,
  listPublishedSkills,
  setCvVisibility,
  upsertCv,
  type CvRow,
} from "../repositories/library.js";
import { serializeProjectSummary } from "../project-serializers.js";
import { serializeSkillSummary } from "../skill-serializers.js";
import type { ChatAppDeps } from "../app.js";

const MAX_CV_UPLOADS_PER_HOUR = 10;
const publicReadLimit = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };

/** Sans guillemet ni caractère de contrôle : la valeur part dans un en-tête HTTP. */
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

function serializeCv(row: CvRow, viewerSignedIn: boolean): Cv {
  return {
    originalName: row.originalName,
    byteSize: row.byteSize,
    visibility: row.visibility,
    updatedAt: row.updatedAt.toISOString(),
    available: row.visibility === "public" || viewerSignedIn,
  };
}

async function requireWritableProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant d'ajouter un CV.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireVisibleProfile(db: ChatAppDeps["db"], handle: string) {
  const profile = await findProfileByHandle(db, handle);
  if (!profile || profile.deletedAt) throw notFound("Ce profil n'existe pas.");
  return profile;
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits }: ChatAppDeps,
): void {
  app.get<{ Params: { handle: string } }>(
    "/api/users/:handle/library",
    publicReadLimit,
    async (request) => {
      const profile = await requireVisibleProfile(db, request.params.handle);
      const viewerId = await getSessionUserId(auth, request);
      const [cv, projectRows, skillRows] = await Promise.all([
        findCv(db, profile.id),
        listOwnedProjects(db, profile.id),
        listPublishedSkills(db, profile.id),
      ]);
      const projects = await Promise.all(
        projectRows.map(async (row) => ({
          ...serializeProjectSummary(row, profile, await countOpenHelpRequests(db, row.id)),
          openRoles: await listOpenRoles(db, row.id, FEED_PROJECT_ROLES),
        })),
      );
      const skills = await Promise.all(
        skillRows.map(async (row) => {
          const [author, stats] = await Promise.all([
            findAuthorProfile(db, row.authorId),
            getSkillStats(db, row.id),
          ]);
          return serializeSkillSummary(row, author, stats);
        }),
      );
      return { cv: cv ? serializeCv(cv, viewerId !== null) : null, projects, skills };
    },
  );

  // Toujours servi en pièce jointe, jamais affiché par le navigateur : un PDF
  // peut embarquer du script. L'aperçu de la page le dessine avec pdf.js, qui
  // n'exécute pas ce script.
  app.get<{ Params: { handle: string } }>(
    "/api/users/:handle/cv/content",
    publicReadLimit,
    async (request, reply) => {
      const profile = await requireVisibleProfile(db, request.params.handle);
      const cv = await findCv(db, profile.id);
      if (!cv) throw notFound("Ce profil n'a pas de CV.");
      if (cv.visibility === "members" && (await getSessionUserId(auth, request)) === null) {
        throw unauthorized();
      }
      reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'")
        .header("Cache-Control", "private, no-cache")
        .header("Content-Length", cv.byteSize)
        .header("Content-Disposition", contentDisposition("attachment", cv.originalName))
        .type("application/pdf");
      return reply.send(storage.read(cv.storageKey));
    },
  );

  app.post(
    "/api/me/cv",
    { config: { rateLimit: { max: MAX_CV_UPLOADS_PER_HOUR, timeWindow: "1 hour" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireWritableProfile(db, userId);
      const maxBytes = Math.min(MAX_CV_BYTES, attachmentLimits.maxAttachmentBytes);
      const part = await request.file({
        limits: { fileSize: maxBytes, files: 1, ...MULTIPART_FIELD_LIMITS },
      });
      if (!part) throw badRequest("Aucun fichier envoyé.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest(
            `Le CV dépasse la taille maximale autorisée (${Math.round(maxBytes / 1024 / 1024)} Mo).`,
          );
        }
        throw error;
      }
      const detected = await detectAttachment(buffer, part.filename);
      if (detected?.mimeType !== "application/pdf") throw badRequest("Le CV doit être un PDF.");

      const storageKey = randomUUID();
      let saved = false;
      const { row, previousKey } = await db
        .transaction(async (tx) => {
          await lockUserStorageQuota(tx, profile.id);
          const previous = await findCv(tx, profile.id);
          const used = (await sumTotalUserStorageBytes(tx, profile.id)) - (previous?.byteSize ?? 0);
          if (used + buffer.length > attachmentLimits.maxUserStorageBytes) {
            throw badRequest("Quota de stockage de fichiers atteint.");
          }
          await storage.save(storageKey, buffer);
          saved = true;
          const upserted = await upsertCv(tx, {
            profileId: profile.id,
            storageKey,
            originalName: sanitizeFilename(part.filename),
            byteSize: buffer.length,
          });
          return { row: upserted, previousKey: previous?.storageKey ?? null };
        })
        // Transaction annulée après l'écriture du fichier : aucun job de
        // nettoyage ne couvre les CV, le nouveau fichier est effacé ici.
        .catch(async (error: unknown) => {
          if (saved) await storage.delete(storageKey);
          throw error;
        });
      // Après la validation seulement : une transaction annulée garde l'ancien fichier.
      if (previousKey) await storage.delete(previousKey);
      return { cv: serializeCv(row, true) };
    },
  );

  app.patch(
    "/api/me/cv",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireWritableProfile(db, userId);
      const { visibility } = updateCvSchema.parse(request.body);
      const row = await setCvVisibility(db, profile.id, visibility);
      if (!row) throw notFound("Aucun CV à régler.");
      return { cv: serializeCv(row, true) };
    },
  );

  app.delete(
    "/api/me/cv",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireWritableProfile(db, userId);
      const row = await deleteCv(db, profile.id);
      if (!row) throw notFound("Aucun CV à retirer.");
      await storage.delete(row.storageKey);
      return { deleted: true };
    },
  );
}
