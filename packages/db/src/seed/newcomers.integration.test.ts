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
  channels,
  messages,
  posts,
  profileCvs,
  profiles,
  spaceMembers,
  spaces,
} from "../schema/index.js";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { seedDemoDataset } from "./demo-dataset.js";
import { seedDemoMedia } from "./demo-media.js";
import { DEMO_CVS, NEWCOMER_ACCOUNTS, NEWCOMER_POSTS } from "./newcomers-content.js";
import { seedNewcomers } from "./newcomers.js";
import { completeDemoRoleDetails, DEMO_ROLE_DETAILS } from "./role-details.js";
import { HACKATHON_MESSAGES, seedHackathonsSpace } from "./hackathons.js";

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

  it("ajoute comptes, CV, posts, réponses de @kocc et messages, une seule fois", async () => {
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
      .where(
        inArray(
          profiles.handle,
          DEMO_ACCOUNTS.map((entry) => entry.handle),
        ),
      );
    expect(original.every((row) => row.interests.length > 0)).toBe(true);

    const newcomers = await db
      .select({ isFiller: profiles.isFiller, userId: profiles.userId })
      .from(profiles)
      .where(
        inArray(
          profiles.handle,
          NEWCOMER_ACCOUNTS.map((entry) => entry.handle),
        ),
      );
    expect(newcomers.every((row) => !row.isFiller && row.userId !== null)).toBe(true);
  });

  it("remplit l'espace des débutants et étiquette des posts", async () => {
    expect(
      await db.$count(spaceMembers, eq(spaceMembers.spaceId, BEGINNERS_SPACE_ID)),
    ).toBeGreaterThan(5);
    expect(await db.$count(messages, sql`${messages.clientId} like 'demo-beginners-%'`)).toBe(10);
    expect(await db.$count(posts, eq(posts.isBeginner, true))).toBeGreaterThanOrEqual(6);
  });

  it("précise le rôle des profils de démonstration une seule fois, sans toucher un vrai compte", async () => {
    await db.update(profiles).set({ isDemo: false }).where(eq(profiles.handle, "ebo-quansah"));
    expect(await completeDemoRoleDetails(db)).toBe(Object.keys(DEMO_ROLE_DETAILS).length - 1);
    expect(await completeDemoRoleDetails(db)).toBe(0);

    const rows = await db
      .select({
        handle: profiles.handle,
        role: profiles.role,
        workMode: profiles.workMode,
        organization: profiles.organization,
      })
      .from(profiles)
      .where(
        inArray(profiles.handle, ["coumba-thiam", "lyna-bouzid", "ahou-kouadio", "ebo-quansah"]),
      );
    const byHandle = new Map(rows.map((row) => [row.handle, row]));
    expect(byHandle.get("coumba-thiam")).toMatchObject({
      role: "developer",
      organization: "Jàmm Pay",
    });
    expect(byHandle.get("lyna-bouzid")).toMatchObject({
      workMode: "freelance",
      organization: null,
    });
    expect(byHandle.get("ahou-kouadio")).toMatchObject({ role: "student" });
    expect(byHandle.get("ebo-quansah")).toMatchObject({ role: null, organization: null });
    await db.update(profiles).set({ isDemo: true }).where(eq(profiles.handle, "ebo-quansah"));
  });

  it("crée l'espace Hackathons et concours une seule fois, public et animé", async () => {
    expect(await seedHackathonsSpace(db)).toEqual({
      status: "done",
      messages: HACKATHON_MESSAGES.length,
    });
    expect(await seedHackathonsSpace(db)).toEqual({ status: "done", messages: 0 });
    const [space] = await db
      .select({ id: spaces.id, visibility: spaces.visibility })
      .from(spaces)
      .where(eq(spaces.slug, "hackathons-concours"));
    expect(space?.visibility).toBe("public");
    expect(await db.$count(spaceMembers, eq(spaceMembers.spaceId, space!.id))).toBeGreaterThan(100);
    expect(await db.$count(channels, eq(channels.spaceId, space!.id))).toBe(3);
  });
});
