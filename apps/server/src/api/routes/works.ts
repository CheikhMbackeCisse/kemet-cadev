import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  createWorkSchema,
  decideWorkInvitationSchema,
  inviteWorkCoauthorSchema,
  MAX_WORK_COAUTHORS,
  paginationQuerySchema,
  updateWorkSchema,
  workListQuerySchema,
  type WorkViewerRole,
} from "@kemet/shared";
import type { Db, DbOrTx } from "@kemet/db";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import { detectAttachment } from "../../storage/detect-attachment.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { KEMET_ASSISTANT_PROFILE_ID } from "../../chat/kemet-assistant.js";
import { findProfileByHandle, findProfileByUserId } from "../repositories/profiles.js";
import { lockUserStorageQuota } from "../repositories/attachments.js";
import { sumTotalUserStorageBytes } from "../repositories/storage-usage.js";
import { computeProfilePoints } from "../repositories/points.js";
import { insertPost } from "../repositories/posts.js";
import {
  deleteWorkAuthor,
  findPendingWorkAttachment,
  findProfilesByHandles,
  findWorkAttachmentById,
  findWorkAttachmentForWork,
  findWorkAuthor,
  findWorkById,
  findWorkBySlug,
  insertPendingWorkAttachment,
  insertWork,
  insertWorkInvitation,
  listPendingWorkInvitations,
  listProfileWorks,
  listWorkInvitations,
  countDiscussionParticipants,
  createWorkDiscussion,
  listWorkLinks,
  listWorks,
  loadWorkPeople,
  replaceExternalAuthors,
  renameWorkDiscussion,
  replaceWorkLinks,
  setWorkAttachment,
  setWorkAuthorStatus,
  softDeleteWork,
  updateWorkFields,
  type WorkRow,
} from "../repositories/works.js";
import {
  serializeProfileWork,
  serializeWorkDetail,
  serializeWorkSummary,
} from "../work-serializers.js";
import { listWorkMedia } from "../repositories/work-media.js";
import { applyWorkMedia } from "./work-media.js";
import type { ChatAppDeps } from "../app.js";

const attachmentParamsSchema = z.object({ id: z.string().uuid() });

const MAX_WORKS_PER_MINUTE = 10;
const MAX_WORK_ATTACHMENTS_PER_MINUTE = 10;
const MAX_WORK_EDITS_PER_MINUTE = 30;
const MAX_INVITATIONS_PER_MINUTE = 30;

async function requireOwnProfile(db: Db, userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complétez votre profil avant de publier un travail.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireWork(db: Db, slug: string) {
  const work = await findWorkBySlug(db, slug);
  if (!work || work.deletedAt) throw notFound("Ce travail n'existe pas.");
  return work;
}

/** Sans guillemet ni caractère de contrôle : la valeur part dans un en-tête HTTP. */
function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex -- on retire justement ces caractères.
  return name.replace(/["\r\n\x00-\x1f]/g, "_").slice(0, 255);
}

/** Comptes Kemet invités comme coauteurs : jamais le publieur ni l'assistant. */
async function resolveCoauthors(db: DbOrTx, handles: string[], publisherHandle: string) {
  const unique = [...new Set(handles)];
  if (unique.includes(publisherHandle)) throw badRequest("Tu es déjà auteur de ce travail.");
  const found = await findProfilesByHandles(db, unique);
  const missing = unique.filter((handle) => !found.some((profile) => profile.handle === handle));
  if (missing.length > 0) throw badRequest(`Aucun compte Kemet pour @${missing[0]}.`);
  if (found.some((profile) => profile.id === KEMET_ASSISTANT_PROFILE_ID)) {
    throw badRequest("L'assistant ne peut pas être coauteur.");
  }
  return found;
}

async function attachPendingPdf(
  tx: DbOrTx,
  workId: string,
  attachmentId: string,
  profileId: string,
) {
  const pending = await findPendingWorkAttachment(tx, attachmentId, profileId);
  if (!pending) throw badRequest("Le PDF envoyé n'est plus disponible pour ce travail.");
  await setWorkAttachment(tx, workId, attachmentId);
}

export async function viewerRoleFor(
  db: DbOrTx,
  work: WorkRow,
  viewerProfileId: string | null,
): Promise<WorkViewerRole | null> {
  if (!viewerProfileId) return null;
  if (work.publisherId === viewerProfileId) return "publisher";
  const author = await findWorkAuthor(db, work.id, viewerProfileId);
  if (author?.status === "accepted") return "coauthor";
  if (author?.status === "pending") return "invited";
  return null;
}

async function buildWorkDetail(db: Db, work: WorkRow, viewerProfileId: string | null) {
  const [people, links, attachment, media, viewerRole, { level }] = await Promise.all([
    loadWorkPeople(db, [work]),
    listWorkLinks(db, work.id),
    findWorkAttachmentForWork(db, work.id),
    listWorkMedia(db, work.id),
    viewerRoleFor(db, work, viewerProfileId),
    computeProfilePoints(db, work.publisherId),
  ]);
  // Le statut des invitations (en attente, refusée) ne regarde que le publieur.
  const invitations =
    viewerRole === "publisher"
      ? (await listWorkInvitations(db, work.id)).map((row) => ({
          status: row.invitation.status,
          profile: row.profile,
        }))
      : null;
  return serializeWorkDetail(work, people.get(work.id)!, {
    publisherLevel: level,
    links,
    attachment,
    media,
    invitations,
    viewerRole,
    participantCount: await countDiscussionParticipants(db, work.channelId),
  });
}

async function toSummaries(db: Db, rows: WorkRow[]) {
  const people = await loadWorkPeople(db, rows);
  return rows.map((row) => serializeWorkSummary(row, people.get(row.id)!));
}

export function registerWorkRoutes(
  app: FastifyInstance,
  { db, auth, storage, attachmentLimits, antiSpamConfig }: ChatAppDeps,
): void {
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/works", async (request) => {
    const query = workListQuerySchema.parse(request.query);
    const page = await listWorks(db, query);
    return { items: await toSummaries(db, page.items), nextCursor: page.nextCursor };
  });

  app.post(
    "/api/works",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_WORKS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const input = createWorkSchema.parse(request.body);
      const coauthors = await resolveCoauthors(db, input.coauthorHandles, profile.handle);

      const work = await db.transaction(async (tx) => {
        const created = await insertWork(tx, {
          publisherId: profile.id,
          slug: input.slug,
          title: input.title,
          type: input.type,
          status: input.status,
          summary: input.summary,
          tags: [...new Set(input.tags)],
          stack: input.stack,
          year: input.year ?? null,
          institution: input.institution?.trim() ? input.institution.trim() : null,
        });
        if (!created) throw conflict("Un travail avec cet identifiant existe déjà.");
        const channel = await createWorkDiscussion(tx, created);
        await replaceWorkLinks(tx, created.id, input.links);
        await replaceExternalAuthors(tx, created.id, input.externalAuthors);
        for (const coauthor of coauthors) await insertWorkInvitation(tx, created.id, coauthor.id);
        if (input.attachmentId)
          await attachPendingPdf(tx, created.id, input.attachmentId, profile.id);
        if (input.media) await applyWorkMedia(tx, created.id, profile.id, input.media);
        // Publier un travail l'annonce dans le fil, sans texte : le post
        // affiche le travail lui-même. Aucun point n'est versé.
        await insertPost(tx, {
          authorId: profile.id,
          body: "",
          format: null,
          testUrl: null,
          testAsk: null,
          sharedPostId: null,
          workId: created.id,
        });
        return { ...created, channelId: channel.id };
      });

      return { work: await buildWorkDetail(db, work, profile.id) };
    },
  );

  app.get<{ Params: { slug: string } }>("/api/works/:slug", async (request) => {
    const work = await requireWork(db, request.params.slug);
    const userId = await getSessionUserId(auth, request);
    const viewer = userId ? await findProfileByUserId(db, userId) : null;
    return { work: await buildWorkDetail(db, work, viewer?.id ?? null) };
  });

  app.patch<{ Params: { slug: string } }>(
    "/api/works/:slug",
    { config: { rateLimit: { max: MAX_WORK_EDITS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const work = await requireWork(db, request.params.slug);
      if (work.publisherId !== profile.id)
        throw forbidden("Seule la personne qui a publié ce travail peut le modifier.");
      const input = updateWorkSchema.parse(request.body);

      const updated = await db.transaction(async (tx) => {
        const row = await updateWorkFields(tx, work.id, {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.tags !== undefined && { tags: [...new Set(input.tags)] }),
          ...(input.stack !== undefined && { stack: input.stack }),
          ...(input.year !== undefined && { year: input.year }),
          ...(input.institution !== undefined && {
            institution: input.institution?.trim() ? input.institution.trim() : null,
          }),
        });
        if (input.title !== undefined && work.channelId)
          await renameWorkDiscussion(tx, work.channelId, input.title);
        if (input.links !== undefined) await replaceWorkLinks(tx, work.id, input.links);
        if (input.externalAuthors !== undefined)
          await replaceExternalAuthors(tx, work.id, input.externalAuthors);
        if (input.attachmentId === null) {
          await setWorkAttachment(tx, work.id, null);
        } else if (input.attachmentId !== undefined) {
          const current = await findWorkAttachmentForWork(tx, work.id);
          if (current?.id !== input.attachmentId)
            await attachPendingPdf(tx, work.id, input.attachmentId, profile.id);
        }
        if (input.media) await applyWorkMedia(tx, work.id, profile.id, input.media);
        return row;
      });

      return { work: await buildWorkDetail(db, updated, profile.id) };
    },
  );

  app.delete<{ Params: { slug: string } }>(
    "/api/works/:slug",
    { config: { rateLimit: { max: MAX_WORK_EDITS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const work = await requireWork(db, request.params.slug);
      if (work.publisherId !== profile.id)
        throw forbidden("Seule la personne qui a publié ce travail peut le supprimer.");
      await softDeleteWork(db, work.id);
      return { deleted: true };
    },
  );

  app.post<{ Params: { slug: string } }>(
    "/api/works/:slug/authors",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_INVITATIONS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const work = await requireWork(db, request.params.slug);
      if (work.publisherId !== profile.id)
        throw forbidden("Seule la personne qui a publié ce travail peut inviter un coauteur.");
      const input = inviteWorkCoauthorSchema.parse(request.body);
      const [coauthor] = await resolveCoauthors(db, [input.handle], profile.handle);
      // Compter puis insérer sous verrou : deux invitations simultanées
      // pourraient sinon dépasser le plafond.
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${work.id}))`);
        if ((await listWorkInvitations(tx, work.id)).length >= MAX_WORK_COAUTHORS) {
          throw badRequest(`Un travail compte au plus ${MAX_WORK_COAUTHORS} coauteurs invités.`);
        }
        const invitation = await insertWorkInvitation(tx, work.id, coauthor!.id);
        if (!invitation) throw conflict("Cette personne a déjà été invitée sur ce travail.");
      });
      return { work: await buildWorkDetail(db, work, profile.id) };
    },
  );

  // Deux usages : le publieur retire un coauteur (ou annule une invitation),
  // ou un coauteur se retire lui-même. Personne d'autre.
  app.delete<{ Params: { slug: string; handle: string } }>(
    "/api/works/:slug/authors/:handle",
    { config: { rateLimit: { max: MAX_INVITATIONS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const work = await requireWork(db, request.params.slug);
      const target = await findProfileByHandle(db, request.params.handle);
      const author = target ? await findWorkAuthor(db, work.id, target.id) : null;

      if (target?.id === profile.id) {
        if (!author || author.status === "declined")
          throw notFound("Tu n'es pas coauteur de ce travail.");
        // Se retirer vaut un refus : la ligne reste, et le publieur ne peut
        // pas relancer la même invitation en boucle.
        await setWorkAuthorStatus(db, author.id, "declined");
        return { removed: true };
      }
      if (work.publisherId !== profile.id)
        throw forbidden("Seule la personne qui a publié ce travail peut retirer un coauteur.");
      if (!author) throw notFound("Cette personne n'est pas coauteur de ce travail.");
      if (author.status === "declined")
        throw conflict("Cette personne a déjà refusé ou s'est retirée.");
      await deleteWorkAuthor(db, author.id);
      return { removed: true };
    },
  );

  app.put<{ Params: { slug: string } }>(
    "/api/works/:slug/invitation",
    { config: { rateLimit: { max: MAX_INVITATIONS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const work = await requireWork(db, request.params.slug);
      const author = await findWorkAuthor(db, work.id, profile.id);
      if (!author) throw notFound("Aucune invitation sur ce travail.");
      if (author.status !== "pending") throw conflict("Cette invitation a déjà reçu une réponse.");
      const input = decideWorkInvitationSchema.parse(request.body);
      await setWorkAuthorStatus(db, author.id, input.accepted ? "accepted" : "declined");
      return { work: await buildWorkDetail(db, work, profile.id) };
    },
  );

  app.get<{ Params: { handle: string }; Querystring: { cursor?: string; limit?: string } }>(
    "/api/users/:handle/works",
    async (request) => {
      const owner = await findProfileByHandle(db, request.params.handle);
      if (!owner) throw notFound("Ce profil n'existe pas.");
      const query = paginationQuerySchema.parse(request.query);
      const page = await listProfileWorks(db, owner.id, query.cursor, query.limit);
      const people = await loadWorkPeople(db, page.items);
      return {
        items: page.items.map((row) => serializeProfileWork(row, people.get(row.id)!, owner.id)),
        nextCursor: page.nextCursor,
      };
    },
  );

  app.get("/api/me/work-invitations", async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile) return { items: [] };
    const rows = await listPendingWorkInvitations(db, profile.id);
    const people = await loadWorkPeople(
      db,
      rows.map((row) => row.work),
    );
    return {
      items: rows.map((row) => ({
        work: serializeWorkSummary(row.work, people.get(row.work.id)!),
        invitedAt: row.invitation.invitedAt.toISOString(),
      })),
    };
  });

  app.post(
    "/api/works/attachments",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_WORK_ATTACHMENTS_PER_MINUTE),
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const part = await request.file();
      if (!part) throw badRequest("Aucun fichier envoyé.");
      let buffer: Buffer;
      try {
        buffer = await part.toBuffer();
      } catch (error) {
        if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
          throw badRequest(
            `Le PDF dépasse la taille maximale autorisée (${attachmentLimits.maxAttachmentBytes} octets).`,
          );
        }
        throw error;
      }
      const detected = await detectAttachment(buffer, part.filename);
      if (detected?.mimeType !== "application/pdf")
        throw badRequest("Seul un PDF est accepté sur un travail.");

      const storageKey = randomUUID();
      const attachment = await db.transaction(async (tx) => {
        await lockUserStorageQuota(tx, profile.id);
        if (
          (await sumTotalUserStorageBytes(tx, profile.id)) + buffer.length >
          attachmentLimits.maxUserStorageBytes
        ) {
          throw badRequest("Quota de stockage de fichiers atteint.");
        }
        await storage.save(storageKey, buffer);
        return insertPendingWorkAttachment(tx, {
          authorId: profile.id,
          storageKey,
          mimeType: detected.mimeType,
          originalName: sanitizeFilename(part.filename),
          byteSize: buffer.length,
        });
      });
      return {
        attachment: {
          id: attachment.id,
          originalName: attachment.originalName,
          byteSize: attachment.byteSize,
        },
      };
    },
  );

  // Publique comme la page du travail. Toujours en téléchargement, jamais
  // affiché dans la page : un PDF peut embarquer du script.
  app.get<{ Params: { id: string } }>(
    "/api/work-attachments/:id/content",
    async (request, reply) => {
      const { id } = attachmentParamsSchema.parse(request.params);
      const attachment = await findWorkAttachmentById(db, id);
      if (!attachment?.workId) throw notFound("Ce fichier n'existe pas.");
      const work = await findWorkById(db, attachment.workId);
      if (!work || work.deletedAt) throw notFound("Ce fichier n'existe pas.");
      reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "default-src 'none'")
        .header("Content-Length", attachment.byteSize)
        .header("Content-Disposition", contentDisposition("attachment", attachment.originalName))
        .type("application/pdf");
      return reply.send(storage.read(attachment.storageKey));
    },
  );
}
