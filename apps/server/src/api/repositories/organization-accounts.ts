import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  opportunities,
  organizationManagers,
  organizationRequests,
  profiles,
  type Db,
  type DbOrTx,
} from "@kemet/db";
import { isReservedHandle, type OrganizationRequestInput } from "@kemet/shared";

type ProfileRow = typeof profiles.$inferSelect;
export type OrganizationRequestRow = typeof organizationRequests.$inferSelect;

/** Organisations actives dont la personne gère la page. */
export async function listManagedOrganizations(
  db: DbOrTx,
  managerId: string,
): Promise<ProfileRow[]> {
  const rows = await db
    .select({ organization: profiles })
    .from(organizationManagers)
    .innerJoin(profiles, eq(profiles.id, organizationManagers.organizationId))
    .where(
      and(
        eq(organizationManagers.managerId, managerId),
        eq(profiles.kind, "organization"),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
      ),
    )
    .orderBy(asc(profiles.displayName));
  return rows.map((row) => row.organization);
}

/** L'organisation active que la personne gère, ou null : le seul contrôle avant de publier en son nom. */
export async function findManagedOrganization(
  db: DbOrTx,
  managerId: string,
  organizationId: string,
): Promise<ProfileRow | null> {
  const managed = await listManagedOrganizations(db, managerId);
  return managed.find((organization) => organization.id === organizationId) ?? null;
}

/**
 * Personne à qui écrire pour une offre d'organisation : la plus ancienne
 * des personnes qui gèrent sa page et peuvent recevoir un message.
 */
export async function findOrganizationContact(
  db: DbOrTx,
  organizationId: string,
): Promise<ProfileRow | null> {
  const [row] = await db
    .select({ manager: profiles })
    .from(organizationManagers)
    .innerJoin(profiles, eq(profiles.id, organizationManagers.managerId))
    .where(
      and(
        eq(organizationManagers.organizationId, organizationId),
        isNotNull(profiles.userId),
        isNull(profiles.deletedAt),
        isNull(profiles.suspendedAt),
      ),
    )
    .orderBy(asc(organizationManagers.createdAt))
    .limit(1);
  return row?.manager ?? null;
}

export async function countPublishedOpportunities(db: DbOrTx, authorId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(and(eq(opportunities.authorId, authorId), isNull(opportunities.deletedAt)));
  return row?.total ?? 0;
}

/** Nom déjà porté par une organisation référencée ou par une autre demande en attente, sans tenir compte de la casse. */
export async function isOrganizationNameTaken(
  db: DbOrTx,
  name: string,
  exceptRequestId?: string,
): Promise<boolean> {
  const key = name.trim().toLowerCase();
  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.kind, "organization"),
        isNull(profiles.deletedAt),
        sql`lower(${profiles.displayName}) = ${key}`,
      ),
    )
    .limit(1);
  if (existing) return true;
  const [pending] = await db
    .select({ id: organizationRequests.id })
    .from(organizationRequests)
    .where(
      and(
        eq(organizationRequests.status, "pending"),
        sql`lower(${organizationRequests.name}) = ${key}`,
        exceptRequestId ? sql`${organizationRequests.id} <> ${exceptRequestId}` : sql`true`,
      ),
    )
    .limit(1);
  return pending !== undefined;
}

export interface NewOrganizationRequest extends OrganizationRequestInput {
  requesterId: string;
  logo: { storageKey: string; mimeType: string; byteSize: number } | null;
}

/** Null si la personne a déjà une demande en attente (index unique partiel). */
export async function insertOrganizationRequest(
  db: DbOrTx,
  input: NewOrganizationRequest,
): Promise<OrganizationRequestRow | null> {
  const [row] = await db
    .insert(organizationRequests)
    .values({
      requesterId: input.requesterId,
      name: input.name,
      organizationType: input.organizationType,
      country: input.country,
      websiteUrl: input.websiteUrl,
      description: input.description,
      logoStorageKey: input.logo?.storageKey ?? null,
      logoMimeType: input.logo?.mimeType ?? null,
      logoByteSize: input.logo?.byteSize ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function findOrganizationRequestById(
  db: DbOrTx,
  id: string,
): Promise<OrganizationRequestRow | null> {
  const [row] = await db.select().from(organizationRequests).where(eq(organizationRequests.id, id));
  return row ?? null;
}

/** Dernière demande envoyée par la personne, quel que soit son état. */
export async function findLatestRequestOf(
  db: DbOrTx,
  requesterId: string,
): Promise<OrganizationRequestRow | null> {
  const [row] = await db
    .select()
    .from(organizationRequests)
    .where(eq(organizationRequests.requesterId, requesterId))
    .orderBy(desc(organizationRequests.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listPendingOrganizationRequests(db: Db) {
  return db
    .select({ request: organizationRequests, requester: profiles })
    .from(organizationRequests)
    .innerJoin(profiles, eq(profiles.id, organizationRequests.requesterId))
    .where(eq(organizationRequests.status, "pending"))
    .orderBy(asc(organizationRequests.createdAt))
    .limit(100);
}

const HANDLE_MAX_LENGTH = 30;

/** Identifiant tiré du nom, sans accent ; "-2", "-3"... si déjà pris. */
export async function deriveOrganizationHandle(db: DbOrTx, name: string): Promise<string> {
  let base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX_LENGTH - 3)
    .replace(/-+$/g, "");
  if (base.length < 3) base = `org-${base || "kemet"}`.replace(/-+$/g, "");
  for (let suffix = 1; suffix < 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (isReservedHandle(candidate)) continue;
    const [taken] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.handle, candidate));
    if (!taken) return candidate;
  }
  throw new Error(`Aucun identifiant libre pour l'organisation "${name}".`);
}

export function organizationLogoUrl(requestId: string): string {
  return `/api/organization-requests/${requestId}/logo`;
}

/**
 * Crée la page de l'organisation, sans compte de connexion, et en donne la
 * gestion à la personne qui l'a demandée. À appeler dans une transaction,
 * après avoir verrouillé la demande.
 */
export async function acceptOrganizationRequest(
  tx: DbOrTx,
  request: OrganizationRequestRow,
  adminId: string,
): Promise<ProfileRow> {
  const handle = await deriveOrganizationHandle(tx, request.name);
  const [organization] = await tx
    .insert(profiles)
    .values({
      kind: "organization",
      organizationType: request.organizationType,
      userId: null,
      handle,
      displayName: request.name,
      country: request.country,
      bio: request.description,
      websiteUrl: request.websiteUrl,
      avatarUrl: request.logoStorageKey ? organizationLogoUrl(request.id) : null,
      onboardingCompletedAt: new Date(),
    })
    .returning();
  await tx
    .insert(organizationManagers)
    .values({ organizationId: organization!.id, managerId: request.requesterId });
  await tx
    .update(organizationRequests)
    .set({
      status: "accepted",
      organizationId: organization!.id,
      decidedById: adminId,
      decidedAt: new Date(),
    })
    .where(eq(organizationRequests.id, request.id));
  return organization!;
}

/** Le logo est effacé par l'appelant, après la transaction. */
export async function refuseOrganizationRequest(
  tx: DbOrTx,
  request: OrganizationRequestRow,
  adminId: string,
): Promise<void> {
  await tx
    .update(organizationRequests)
    .set({
      status: "refused",
      decidedById: adminId,
      decidedAt: new Date(),
      logoStorageKey: null,
      logoMimeType: null,
      logoByteSize: null,
    })
    .where(eq(organizationRequests.id, request.id));
}

export async function lockOrganizationRequest(
  tx: DbOrTx,
  id: string,
): Promise<OrganizationRequestRow | null> {
  const [row] = await tx
    .select()
    .from(organizationRequests)
    .where(eq(organizationRequests.id, id))
    .for("update");
  return row ?? null;
}
