import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { profiles, user } from "../schema/index.js";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { DEFAULT_FILLER_PROFILE_COUNT, seedDemoDataset } from "./demo-dataset.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("seed de démonstration", () => {
  const db = createDb(databaseUrl ?? "");

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
  });

  it("crée les comptes de démonstration sans aucun administrateur", async () => {
    const result = await seedDemoDataset(db);
    expect(result).toEqual({ status: "created", fillerProfileCount: DEFAULT_FILLER_PROFILE_COUNT });

    const admins = await db.select().from(profiles).where(eq(profiles.isPlatformAdmin, true));
    expect(admins).toHaveLength(0);
  }, 120_000);

  it("ne crée rien la deuxième fois", async () => {
    const before = await db.$count(profiles);
    expect(await seedDemoDataset(db)).toEqual({ status: "already-present" });
    expect(await db.$count(profiles)).toBe(before);
  }, 120_000);

  it("refuse de continuer si un compte de démonstration est administrateur", async () => {
    const [demo] = await db.select().from(profiles).where(eq(profiles.handle, DEMO_ACCOUNTS[0]!.handle));
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, demo!.id));
    await expect(seedDemoDataset(db)).rejects.toThrow(/administrateur/);
    await db.update(profiles).set({ isPlatformAdmin: false }).where(eq(profiles.id, demo!.id));
  });

  it("refuse une base où il ne reste qu'une partie des comptes de démonstration", async () => {
    await db.delete(user).where(eq(user.email, DEMO_ACCOUNTS[0]!.email));
    await expect(seedDemoDataset(db)).rejects.toThrow(/état partiel/);
  }, 120_000);
});
