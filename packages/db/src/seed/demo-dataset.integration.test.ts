import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { assistantInvocations, messages, pointsLedger, profiles, user } from "../schema/index.js";
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

  it("pose des échanges avec @kemet marqués comme enregistrés, avec leurs points", async () => {
    const invocations = await db.select().from(assistantInvocations);
    expect(invocations).toHaveLength(3);
    for (const invocation of invocations) {
      expect(invocation).toMatchObject({ status: "done", recorded: true });
      expect(invocation.skillIds).toHaveLength(1);
      const [response] = await db.select().from(messages).where(eq(messages.id, invocation.responseMessageId!));
      const [author] = await db.select().from(profiles).where(eq(profiles.id, response!.authorId));
      expect(author!.handle).toBe("kemet");
    }

    const helpful = invocations.filter((invocation) => invocation.helpful === true);
    const awards = await db.select().from(pointsLedger).where(eq(pointsLedger.source, "assistant_skill_helpful"));
    expect(awards.map((award) => award.sourceId).sort()).toEqual(helpful.map((invocation) => invocation.id).sort());
    expect(awards.every((award) => award.givenByProfileId !== award.profileId)).toBe(true);
  });

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
