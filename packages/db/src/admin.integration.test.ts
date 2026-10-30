import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { promotePlatformAdmin } from "./admin.js";
import { createDb } from "./client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "./testing.js";
import { profiles, user } from "./schema/index.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("promotion d'un administrateur", () => {
  const db = createDb(databaseUrl ?? "");

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
  });

  async function createAccount(
    handle: string,
    options: { isDemo?: boolean; withProfile?: boolean; emailVerified?: boolean; suspended?: boolean } = {},
  ) {
    const userId = randomUUID();
    const email = `${handle}@test.kemet`;
    await db.insert(user).values({ id: userId, name: handle, email, emailVerified: options.emailVerified ?? true });
    if (options.withProfile !== false) {
      await db.insert(profiles).values({
        userId,
        handle,
        displayName: handle,
        country: "SN",
        isDemo: options.isDemo ?? false,
        suspendedAt: options.suspended ? new Date() : null,
      });
    }
    return email;
  }

  async function isAdmin(email: string) {
    const [row] = await db
      .select({ isPlatformAdmin: profiles.isPlatformAdmin })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .where(eq(user.email, email));
    return row?.isPlatformAdmin;
  }

  it("promeut un compte existant, une seule fois", async () => {
    const email = await createAccount("future-admin");
    expect(await promotePlatformAdmin(db, email)).toBe("promoted");
    expect(await isAdmin(email)).toBe(true);
    expect(await promotePlatformAdmin(db, ` ${email.toUpperCase()} `)).toBe("already-admin");
  });

  it("refuse un compte de démonstration", async () => {
    const email = await createAccount("demo-account", { isDemo: true });
    await expect(promotePlatformAdmin(db, email)).rejects.toThrow(/démonstration/);
    expect(await isAdmin(email)).toBe(false);
  });

  it("refuse une adresse non vérifiée ou un compte suspendu", async () => {
    const unverified = await createAccount("unverified", { emailVerified: false });
    await expect(promotePlatformAdmin(db, unverified)).rejects.toThrow(/vérifiée/);
    const suspended = await createAccount("suspended", { suspended: true });
    await expect(promotePlatformAdmin(db, suspended)).rejects.toThrow(/suspendu/);
    expect(await isAdmin(unverified)).toBe(false);
    expect(await isAdmin(suspended)).toBe(false);
  });

  it("refuse une adresse inconnue ou un compte sans profil", async () => {
    await expect(promotePlatformAdmin(db, "personne@test.kemet")).rejects.toThrow(/Aucun compte/);
    const email = await createAccount("no-profile", { withProfile: false });
    await expect(promotePlatformAdmin(db, email)).rejects.toThrow(/profil/);
  });
});
