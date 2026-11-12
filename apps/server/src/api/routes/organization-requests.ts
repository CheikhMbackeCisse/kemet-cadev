import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import {
  decideOrganizationRequestSchema,
  ORGANIZATION_LOGO_MAX_BYTES,
  ORGANIZATION_LOGO_MIME_TYPES,
  organizationRequestInputSchema,
  readImageSize,
  type ManagedOrganization,
  type OrganizationRequest,
} from "@kemet/shared";
import { getSessionUserId, requireSessionUserId } from "../../auth/session.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors.js";
import { antiSpamMax } from "../../moderation/anti-spam.js";
import { contentDisposition } from "../../storage/content-disposition.js";
import { findProfileById } from "../repositories/chat.js";
import {
  acceptOrganizationRequest,
  findLatestRequestOf,
  findOrganizationRequestById,
  insertOrganizationRequest,
  isOrganizationNameTaken,
  listManagedOrganizations,
  listPendingOrganizationRequests,
  lockOrganizationRequest,
  organizationLogoUrl,
  refuseOrganizationRequest,
  type OrganizationRequestRow,
} from "../repositories/organization-accounts.js";
import { findProfileByUserId } from "../repositories/profiles.js";
import type { ChatAppDeps } from "../app.js";
import type { profiles } from "@kemet/db";

type ProfileRow = typeof profiles.$inferSelect;

// Plus grand côté d'un logo : un en-tête qui annonce une image démesurée
// ferait décoder des centaines de mégaoctets au navigateur.
const LOGO_MAX_SIDE_PX = 4096;
const TEXT_FIELDS = ["name", "organizationType", "country", "websiteUrl", "description"] as const;
const MAX_REQUESTS_PER_HOUR = 5;

const requestIdParamsSchema = z.object({ id: z.string().uuid() });

async function requireOwnProfile(db: ChatAppDeps["db"], userId: string) {
  const profile = await findProfileByUserId(db, userId);
  if (!profile) throw badRequest("Complète ton profil avant de référencer une organisation.");
  if (profile.suspendedAt) throw forbidden("Ce compte est suspendu.");
  return profile;
}

async function requireAdmin(db: ChatAppDeps["db"], userId: string) {
  const profile = await requireOwnProfile(db, userId);
  if (!profile.isPlatformAdmin) throw forbidden("Réservé aux administrateurs.");
  return profile;
}

function serializeRequest(
  row: OrganizationRequestRow,
  requester: ProfileRow,
  organizationHandle: string | null,
): OrganizationRequest {
  return {
    id: row.id,
    name: row.name,
    organizationType: row.organizationType,
    country: row.country,
    websiteUrl: row.websiteUrl,
    description: row.description,
    logoUrl: row.logoStorageKey ? organizationLogoUrl(row.id) : null,
    status: row.status,
    requesterHandle: requester.handle,
    requesterDisplayName: requester.displayName,
    organizationHandle,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

export function serializeManagedOrganization(row: ProfileRow): ManagedOrganization {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    organizationType: row.organizationType!,
  };
}

interface ParsedRequestForm {
  fields: Record<string, string>;
  logo: { buffer: Buffer; mimeType: string } | null;
}

async function readRequestForm(request: FastifyRequest): Promise<ParsedRequestForm> {
  const fields: Record<string, string> = {};
  let logo: ParsedRequestForm["logo"] = null;
  const parts = request.parts({
    limits: {
      fileSize: ORGANIZATION_LOGO_MAX_BYTES,
      files: 1,
      fields: TEXT_FIELDS.length,
      fieldSize: 1024,
      parts: TEXT_FIELDS.length + 1,
    },
  });
  try {
    for await (const part of parts) {
      if (part.type === "file") {
        if (part.fieldname !== "logo" || logo)
          throw badRequest("Un seul logo, dans le champ logo.");
        const buffer = await part.toBuffer();
        const detected = await fileTypeFromBuffer(buffer);
        if (
          !detected ||
          !(ORGANIZATION_LOGO_MIME_TYPES as readonly string[]).includes(detected.mime)
        ) {
          throw badRequest("Le logo doit être une image PNG, JPEG ou WebP.");
        }
        const size = readImageSize(buffer, detected.mime);
        if (!size || size.width > LOGO_MAX_SIDE_PX || size.height > LOGO_MAX_SIDE_PX) {
          throw badRequest(`Le logo doit mesurer au plus ${LOGO_MAX_SIDE_PX} pixels de côté.`);
        }
        logo = { buffer, mimeType: detected.mime };
      } else {
        const name = part.fieldname;
        if (!(TEXT_FIELDS as readonly string[]).includes(name) || name in fields) {
          throw badRequest("Champ inattendu dans la demande.");
        }
        fields[name] = String(part.value);
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw badRequest("Le logo dépasse 1 Mo.");
    }
    throw error;
  }
  return { fields, logo };
}

function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

export function registerOrganizationRequestRoutes(
  app: FastifyInstance,
  { db, auth, storage, antiSpamConfig }: ChatAppDeps,
): void {
  const readLimit = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };
  const adminLimit = { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } };

  app.post(
    "/api/organization-requests",
    {
      config: {
        rateLimit: {
          max: antiSpamMax(db, auth, antiSpamConfig, MAX_REQUESTS_PER_HOUR),
          timeWindow: "1 hour",
        },
      },
    },
    async (request) => {
      const userId = await requireSessionUserId(auth, request);
      const profile = await requireOwnProfile(db, userId);
      const form = await readRequestForm(request);
      const input = organizationRequestInputSchema.parse({
        name: form.fields.name ?? "",
        organizationType: form.fields.organizationType,
        country: form.fields.country,
        websiteUrl: form.fields.websiteUrl ?? "",
        description: form.fields.description ?? "",
      });

      if (await findLatestRequestOf(db, profile.id).then((row) => row?.status === "pending")) {
        throw conflict("Ta demande précédente est encore en attente.");
      }
      if (await isOrganizationNameTaken(db, input.name)) {
        throw conflict("Une organisation porte déjà ce nom sur Kemet.");
      }

      const storageKey = form.logo ? randomUUID() : null;
      if (form.logo && storageKey) await storage.save(storageKey, form.logo.buffer);
      const created = await insertOrganizationRequest(db, {
        ...input,
        requesterId: profile.id,
        logo:
          form.logo && storageKey
            ? { storageKey, mimeType: form.logo.mimeType, byteSize: form.logo.buffer.length }
            : null,
      }).catch(async (error: unknown) => {
        if (storageKey) await storage.delete(storageKey);
        throw error;
      });
      if (!created) {
        if (storageKey) await storage.delete(storageKey);
        throw conflict("Ta demande précédente est encore en attente.");
      }
      return { request: serializeRequest(created, profile, null) };
    },
  );

  app.get("/api/me/organization-request", readLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile) return { request: null };
    const latest = await findLatestRequestOf(db, profile.id);
    if (!latest) return { request: null };
    const organization = latest.organizationId
      ? await findProfileById(db, latest.organizationId)
      : null;
    return { request: serializeRequest(latest, profile, organization?.handle ?? null) };
  });

  app.get("/api/me/organizations", readLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const profile = await findProfileByUserId(db, userId);
    if (!profile || profile.suspendedAt) return { items: [] };
    const managed = await listManagedOrganizations(db, profile.id);
    return { items: managed.map(serializeManagedOrganization) };
  });

  app.get("/api/organization-requests", adminLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    await requireAdmin(db, userId);
    const rows = await listPendingOrganizationRequests(db);
    return { items: rows.map((row) => serializeRequest(row.request, row.requester, null)) };
  });

  app.put("/api/organization-requests/:id", adminLimit, async (request) => {
    const userId = await requireSessionUserId(auth, request);
    const admin = await requireAdmin(db, userId);
    const { id } = requestIdParamsSchema.parse(request.params);
    const { decision } = decideOrganizationRequestSchema.parse(request.body);

    let logoToDelete: string | null = null;
    const outcome = await db
      .transaction(async (tx) => {
        const locked = await lockOrganizationRequest(tx, id);
        if (!locked) throw notFound("Cette demande n'existe pas.");
        if (locked.status !== "pending") throw conflict("Cette demande a déjà été traitée.");
        if (decision === "refuse") {
          logoToDelete = locked.logoStorageKey;
          await refuseOrganizationRequest(tx, locked, admin.id);
          return { status: "refused" as const, organizationHandle: null };
        }
        if (locked.requesterId === admin.id) {
          throw conflict("Une autre personne de l'administration doit accepter ta demande.");
        }
        const requester = await findProfileById(tx, locked.requesterId);
        if (!requester || requester.suspendedAt || requester.deletedAt) {
          throw conflict(
            "Le compte qui a envoyé cette demande ne peut plus gérer une organisation.",
          );
        }
        if (await isOrganizationNameTaken(tx, locked.name, locked.id)) {
          throw conflict("Une organisation porte déjà ce nom sur Kemet.");
        }
        const organization = await acceptOrganizationRequest(tx, locked, admin.id);
        return { status: "accepted" as const, organizationHandle: organization.handle };
      })
      .catch((error: unknown) => {
        // Deux acceptations simultanées qui tirent le même identifiant : la
        // seconde heurte l'index unique, l'administration réessaie.
        if (isUniqueViolation(error))
          throw conflict("Réessaie : cet identifiant vient d'être pris.");
        throw error;
      });
    if (logoToDelete) await storage.delete(logoToDelete);
    return outcome;
  });

  // Logo d'une demande acceptée : public, c'est la photo de la page. Avant
  // l'acceptation, seuls la personne qui l'a envoyé et les administrateurs le
  // voient ; après un refus, le fichier n'existe plus.
  app.get("/api/organization-requests/:id/logo", readLimit, async (request, reply) => {
    const { id } = requestIdParamsSchema.parse(request.params);
    const found = await findOrganizationRequestById(db, id);
    if (!found || !found.logoStorageKey || !found.logoMimeType || found.logoByteSize === null) {
      throw notFound("Ce logo n'existe pas.");
    }
    let isPublic = false;
    if (found.status === "accepted" && found.organizationId) {
      const organization = await findProfileById(db, found.organizationId);
      isPublic =
        organization !== null &&
        organization.deletedAt === null &&
        organization.suspendedAt === null;
    }
    if (!isPublic) {
      const userId = await getSessionUserId(auth, request);
      const viewer = userId ? await findProfileByUserId(db, userId) : null;
      if (!viewer || (viewer.id !== found.requesterId && !viewer.isPlatformAdmin)) {
        throw notFound("Ce logo n'existe pas.");
      }
    }
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "default-src 'none'")
      .header("Cache-Control", isPublic ? "public, max-age=3600" : "private, no-store")
      .header("Content-Length", found.logoByteSize)
      .header("Content-Disposition", contentDisposition("inline", "logo"))
      .type(found.logoMimeType);
    return reply.send(storage.read(found.logoStorageKey));
  });
}
