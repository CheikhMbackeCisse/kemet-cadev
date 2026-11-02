import { and, eq } from "drizzle-orm";
import { credentialPoints, credentials, pointsLedger, type Db } from "@kemet/db";

export async function findCredentialById(db: Db, credentialId: string) {
  const [credential] = await db.select().from(credentials).where(eq(credentials.id, credentialId));
  return credential ?? null;
}

/**
 * Passe un élément de parcours de déclaré à vérifié et inscrit ses points au
 * registre, dans la même transaction. `null` s'il était déjà vérifié : la
 * condition sur le statut rend un second appel sans effet.
 */
export async function verifyCredential(
  db: Db,
  credentialId: string,
  verification: { method: string; verifiedByProfileId: string },
  verifiedAt = new Date(),
) {
  return db.transaction(async (tx) => {
    const [verified] = await tx
      .update(credentials)
      .set({
        status: "verified",
        verificationMethod: verification.method,
        verifiedByProfileId: verification.verifiedByProfileId,
        verifiedAt,
      })
      .where(and(eq(credentials.id, credentialId), eq(credentials.status, "declared")))
      .returning();
    if (!verified) return null;
    // Pas de donneur : le plafond quotidien vise l'entraide entre membres,
    // le parcours a son propre plafond à la lecture.
    await tx
      .insert(pointsLedger)
      .values({
        profileId: verified.profileId,
        source: "credential_verified",
        sourceId: verified.id,
        amount: credentialPoints(verified, verifiedAt),
        givenByProfileId: null,
        createdAt: verifiedAt,
      })
      .onConflictDoNothing({ target: [pointsLedger.source, pointsLedger.sourceId, pointsLedger.profileId] });
    return verified;
  });
}
