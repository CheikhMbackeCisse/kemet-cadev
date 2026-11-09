import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import {
  assistantInvocations,
  BEGINNERS_SPACE_ID,
  messages,
  posts,
  profileCvs,
  profiles,
  spaceMembers,
} from "../schema/index.js";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { seedDemoDataset } from "./demo-dataset.js";
import { seedDemoMedia } from "./demo-media.js";
import { DEMO_CVS, NEWCOMER_ACCOUNTS, NEWCOMER_POSTS } from "./newcomers-content.js";
import { seedNewcomers } from "./newcomers.js";

const databaseUrl = getTestDatabaseUrl();
const passwordHash = () => Promise.resolve("hash-de-test");

describe.skipIf(!databaseUrl)("débutants, recruteurs et bibliothèques de démonstration", () => {
  const db = createDb(databaseUrl ?? "");
  let uploadsDir = "";

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
    uploadsDir = await mkdtemp(join(tmpdir(), "kemet-newcomers-"));
  });

  afterAll(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it("ne fait rien sans les comptes de démonstration d'origine", async () => {
    expect(await seedNewcomers(db, { uploadsDir, passwordHash })).toMatchObject({
      status: "skipped",
    });
  });

  it("ajoute comptes, CV, posts, réponses de @kemet et messages, une seule fois", async () => {
    await seedDemoDataset(db);
    await seedDemoMedia(db, { uploadsDir });
    const first = await seedNewcomers(db, { uploadsDir, passwordHash });
    expect(first).toEqual({
      status: "done",
      accounts: NEWCOMER_ACCOUNTS.length,
      cvs: DEMO_CVS.length,
      posts: NEWCOMER_POSTS.length,
      spaceMessages: 10,
      filesWritten: true,
    });

    const cvs = await db.select().from(profileCvs);
    expect(cvs).toHaveLength(DEMO_CVS.length);
    const pdf = await readFile(join(uploadsDir, cvs[0]!.storageKey));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    const answers = await db
      .select({ id: assistantInvocations.id })
      .from(assistantInvocations)
      .where(and(isNotNull(assistantInvocations.postId), eq(assistantInvocations.recorded, true)));
    expect(answers).toHaveLength(2);

    expect(await seedNewcomers(db, { uploadsDir, passwordHash })).toEqual({
      status: "done",
      accounts: 0,
      cvs: 0,
      posts: 0,
      spaceMessages: 0,
      filesWritten: true,
    });
    expect(await db.$count(profileCvs)).toBe(DEMO_CVS.length);
  }, 300_000);

  it("donne des sujets aux comptes d'origine et ne crée aucun figurant", async () => {
    const original = await db
      .select({ interests: profiles.interests })
      .from(profiles)
      .where(inArray(profiles.handle, DEMO_ACCOUNTS.map((entry) => entry.handle)));
    expect(original.every((row) => row.interests.length > 0)).toBe(true);

    const newcomers = await db
      .select({ isFiller: profiles.isFiller, userId: profiles.userId })
      .from(profiles)
      .where(inArray(profiles.handle, NEWCOMER_ACCOUNTS.map((entry) => entry.handle)));
    expect(newcomers.every((row) => !row.isFiller && row.userId !== null)).toBe(true);
  });

  it("remplit l'espace des débutants et étiquette des posts", async () => {
    expect(
      await db.$count(spaceMembers, eq(spaceMembers.spaceId, BEGINNERS_SPACE_ID)),
    ).toBeGreaterThan(5);
    expect(await db.$count(messages, sql`${messages.clientId} like 'demo-beginners-%'`)).toBe(10);
    expect(await db.$count(posts, eq(posts.isBeginner, true))).toBeGreaterThanOrEqual(6);
  });
});
