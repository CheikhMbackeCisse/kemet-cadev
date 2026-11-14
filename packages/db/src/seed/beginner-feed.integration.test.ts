import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import {
  feedPinnedPosts,
  helpRequests,
  postReactions,
  postReplies,
  posts,
  profiles,
  projects,
  skills,
} from "../schema/index.js";
import { BEGINNER_FEED_POSTS, LOOPS_POST, LOOPS_SKILL } from "./beginner-feed-content.js";
import { LOOPS_POST_ID, seedBeginnerFeed } from "./beginner-feed.js";
import { seedCadevSpace } from "./cadev-space.js";
import { renameCadevSpace } from "./chat-content.js";
import { seedDemoDataset } from "./demo-dataset.js";
import { seedDemoMedia } from "./demo-media.js";
import { demoUuid } from "./demo-uuid.js";
import { seedNewcomers } from "./newcomers.js";
import { IN_PROGRESS_PROJECTS, seedProjectsInProgress } from "./projects-in-progress.js";
import { seedShowcase } from "./showcase.js";

const databaseUrl = getTestDatabaseUrl();
const passwordHash = () => Promise.resolve("hash-de-test");

describe.skipIf(!databaseUrl)("fil des débutants et projets en cours", () => {
  const db = createDb(databaseUrl ?? "");
  let uploadsDir = "";

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
    uploadsDir = await mkdtemp(join(tmpdir(), "kemet-beginner-feed-"));
    await seedDemoDataset(db);
    await renameCadevSpace(db);
    await seedDemoMedia(db, { uploadsDir });
    await seedNewcomers(db, { uploadsDir, passwordHash });
    await seedShowcase(db);
    await seedCadevSpace(db);
  }, 180_000);

  afterAll(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it("épingle le post sur les boucles juste après celui de Systalink, sans rien doubler", async () => {
    const first = await seedBeginnerFeed(db);
    expect(first).toEqual({
      status: "done",
      posts: 1 + BEGINNER_FEED_POSTS.length,
      replies:
        LOOPS_POST.replies.length +
        BEGINNER_FEED_POSTS.reduce((total, post) => total + post.replies.length, 0),
      skill: true,
    });
    expect(await seedBeginnerFeed(db)).toEqual({ status: "done", posts: 0, replies: 0, skill: false });

    const pins = await db.select().from(feedPinnedPosts).orderBy(asc(feedPinnedPosts.position));
    expect(pins.map((pin) => [pin.postId, pin.position])).toEqual([
      [demoUuid("post:cadev-en-bref"), 0],
      [LOOPS_POST_ID, 1],
    ]);
    const [loops] = await db.select().from(posts).where(eq(posts.id, LOOPS_POST_ID));
    expect(loops).toMatchObject({ isBeginner: true, body: LOOPS_POST.body });
    // Sous ce post, aucune réponse de Kocc : la question sera posée en direct.
    const replies = await db.select().from(postReplies).where(eq(postReplies.postId, LOOPS_POST_ID));
    expect(replies).toHaveLength(LOOPS_POST.replies.length);
  });

  it("donne aux posts débutants les cœurs qui les placent entre les posts pointus", async () => {
    for (const post of BEGINNER_FEED_POSTS) {
      const postId = demoUuid(`beginner-feed-post:${post.key}`);
      expect(await db.$count(postReactions, eq(postReactions.postId, postId)), post.key).toBe(post.hearts);
    }
  });

  it("publie le skill que Kocc cite sous le post sur les boucles", async () => {
    const [skill] = await db.select().from(skills).where(eq(skills.slug, LOOPS_SKILL.slug));
    const [author] = await db
      .select({ handle: profiles.handle })
      .from(profiles)
      .where(eq(profiles.id, skill!.authorId));
    expect(skill).toMatchObject({ name: LOOPS_SKILL.name, visibility: "public", isBeginner: true, isDemo: true });
    expect(author!.handle).toBe(LOOPS_POST.authorHandle);
  });

  it("ajoute les projets en cours et leurs demandes une seule fois, sans toucher un slug déjà pris", async () => {
    const taken = IN_PROGRESS_PROJECTS[0]!;
    const [real] = await db
      .insert(profiles)
      .values({ handle: "vraie-personne", displayName: "Vraie Personne", country: "SN" })
      .returning({ id: profiles.id });
    await db.insert(projects).values({
      ownerId: real!.id,
      slug: taken.slug,
      name: "Projet réel",
      pitch: "Un projet publié par une vraie personne.",
      repoUrl: "https://github.com/vraie-personne/projet",
    });

    const withRequest = IN_PROGRESS_PROJECTS.filter((project) => project.request !== null).length;
    expect(await seedProjectsInProgress(db)).toEqual({
      status: "done",
      projects: IN_PROGRESS_PROJECTS.length - 1,
      requests: withRequest - 1,
    });
    expect(await seedProjectsInProgress(db)).toEqual({ status: "done", projects: 0, requests: 0 });

    const [kept] = await db.select().from(projects).where(eq(projects.slug, taken.slug));
    expect(kept).toMatchObject({ ownerId: real!.id, name: "Projet réel" });
    expect(await db.$count(helpRequests, eq(helpRequests.projectId, kept!.id))).toBe(0);
    const open = await db
      .select({ id: helpRequests.id })
      .from(helpRequests)
      .innerJoin(projects, eq(projects.id, helpRequests.projectId))
      .where(
        and(
          inArray(
            projects.slug,
            IN_PROGRESS_PROJECTS.map((project) => project.slug),
          ),
          eq(helpRequests.status, "open"),
        ),
      );
    expect(open).toHaveLength(withRequest - 1);
  });
});
