import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "./client.js";
import { profiles, user } from "./schema/index.js";

export type PromoteAdminResult = "promoted" | "already-admin";

/** Donne le rôle administrateur au profil du compte qui porte cet email. Refuse une adresse non vérifiée, un compte suspendu ou de démonstration. */
export async function promotePlatformAdmin(db: DbOrTx, email: string): Promise<PromoteAdminResult> {
  const [row] = await db
    .select({
      emailVerified: user.emailVerified,
      profileId: profiles.id,
      isDemo: profiles.isDemo,
      isPlatformAdmin: profiles.isPlatformAdmin,
      suspendedAt: profiles.suspendedAt,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(sql`lower(${user.email})`, email.trim().toLowerCase()));

  if (!row) throw new Error(`Aucun compte avec l'adresse ${email}.`);
  if (!row.emailVerified) throw new Error(`L'adresse ${email} n'a pas été vérifiée.`);
  if (!row.profileId) throw new Error(`Le compte ${email} n'a pas encore complété son profil.`);
  if (row.suspendedAt) throw new Error(`Le compte ${email} est suspendu.`);
  if (row.isDemo) throw new Error("Un compte de démonstration ne peut pas être administrateur : son mot de passe est public.");
  if (row.isPlatformAdmin) return "already-admin";

  await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, row.profileId));
  return "promoted";
}
