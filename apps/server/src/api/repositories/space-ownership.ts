import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { profiles, spaceInvites, spaceMembers, spaces, type Db } from "@kemet/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Verrouille, dans l'ordre des identifiants, chaque espace dont la personne
 * est membre. Deux départs simultanés d'un même espace (le propriétaire et
 * son seul successeur) passent ainsi l'un après l'autre : sans ce verrou, le
 * second ne verrait pas la promotion faite par le premier et l'espace
 * resterait sans propriétaire ni archivage.
 */
export async function lockSpacesOfMember(tx: Tx, profileId: string, spaceIds?: string[]) {
  const memberOf = tx
    .select({ spaceId: spaceMembers.spaceId })
    .from(spaceMembers)
    .where(eq(spaceMembers.profileId, profileId));
  await tx
    .select({ id: spaces.id })
    .from(spaces)
    .where(spaceIds ? inArray(spaces.id, spaceIds) : inArray(spaces.id, memberOf))
    .orderBy(asc(spaces.id))
    .for("update");
}

/**
 * Un propriétaire qui part (compte supprimé ou départ de l'espace) laisse la
 * propriété à l'administrateur le plus ancien, sinon au membre le plus
 * ancien, un compte suspendu en dernier recours. Sans autre membre, l'espace
 * est archivé et ses invitations révoquées (ADR 0023).
 */
export async function handOverSpace(tx: Tx, spaceId: string, leavingProfileId: string, now: Date) {
  const [leaving] = await tx
    .select({ role: spaceMembers.role })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, leavingProfileId)));
  if (leaving?.role !== "owner") return;

  const [successor] = await tx
    .select({ id: spaceMembers.id })
    .from(spaceMembers)
    .innerJoin(profiles, eq(profiles.id, spaceMembers.profileId))
    // Jamais un figurant du seed : un propriétaire doit pouvoir être vu et joint.
    .where(
      and(eq(spaceMembers.spaceId, spaceId), ne(spaceMembers.profileId, leavingProfileId), eq(profiles.isFiller, false)),
    )
    .orderBy(
      asc(sql`${profiles.suspendedAt} is not null`),
      asc(sql`case ${spaceMembers.role} when 'admin' then 0 else 1 end`),
      asc(spaceMembers.joinedAt),
      asc(spaceMembers.id),
    )
    .limit(1);
  if (successor) {
    await tx.update(spaceMembers).set({ role: "owner" }).where(eq(spaceMembers.id, successor.id));
    return;
  }
  await tx.update(spaces).set({ archivedAt: now }).where(eq(spaces.id, spaceId));
  await tx
    .update(spaceInvites)
    .set({ revokedAt: now })
    .where(and(eq(spaceInvites.spaceId, spaceId), isNull(spaceInvites.revokedAt)));
}

/** Toutes les propriétés d'une personne qui supprime son compte. */
export async function handOverOwnedSpaces(tx: Tx, profileId: string, now: Date) {
  await lockSpacesOfMember(tx, profileId);
  const owned = await tx
    .select({ spaceId: spaceMembers.spaceId })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.profileId, profileId), eq(spaceMembers.role, "owner")));
  for (const { spaceId } of owned) await handOverSpace(tx, spaceId, profileId, now);
}

/** Départ volontaire d'un espace, avec transfert si la personne en est propriétaire. */
export async function leaveSpace(db: Db, spaceId: string, profileId: string) {
  await db.transaction(async (tx) => {
    await lockSpacesOfMember(tx, profileId, [spaceId]);
    await handOverSpace(tx, spaceId, profileId, new Date());
    await tx
      .delete(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, profileId)));
  });
}
