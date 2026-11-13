import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import {
  assistantInvocations,
  competitions,
  messages,
  postReactions,
  postReplies,
  posts,
  profiles,
  submissions,
  works,
} from "../schema/index.js";
import { seedDemoDataset } from "./demo-dataset.js";
import { seedShowcase } from "./showcase.js";
import { SHOWCASE_SUBMISSIONS, WAVE_SHOWCASE } from "./showcase-content.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("vitrine du fil", () => {
  const db = createDb(databaseUrl ?? "");

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
  });

  it("n'écrit jamais au nom d'un compte réel qui porte un identifiant de démonstration", async () => {
    const handles = [
      WAVE_SHOWCASE.authorHandle,
      ...WAVE_SHOWCASE.replies.map((reply) => reply.authorHandle),
    ];
    await db
      .insert(profiles)
      .values(
        [...new Set(handles)].map((handle) => ({ handle, displayName: handle, country: "SN" })),
      );

    const result = await seedShowcase(db);

    expect(result.status).toBe("skipped");
    expect(await db.select().from(posts).where(eq(posts.body, WAVE_SHOWCASE.body))).toHaveLength(0);
  });

  it("pose la question Wave avec sa réponse enregistrée et des soumissions, sans rien doubler", async () => {
    await seedDemoDataset(db);
    expect(await seedShowcase(db)).toEqual({ status: "done" });
    expect(await seedShowcase(db)).toEqual({ status: "done" });

    const [wave] = await db.select().from(posts).where(eq(posts.body, WAVE_SHOWCASE.body));
    const replies = await db
      .select()
      .from(postReplies)
      .where(and(eq(postReplies.postId, wave!.id), isNull(postReplies.deletedAt)));
    expect(replies).toHaveLength(2 + WAVE_SHOWCASE.replies.length);
    const hearts = await db.select().from(postReactions).where(eq(postReactions.postId, wave!.id));
    expect(hearts).toHaveLength(WAVE_SHOWCASE.hearts);
    const [invocation] = await db
      .select()
      .from(assistantInvocations)
      .where(eq(assistantInvocations.postId, wave!.id));
    expect(invocation).toMatchObject({ status: "done", recorded: true });

    const slugs = SHOWCASE_SUBMISSIONS.map((plan) => plan.competitionSlug);
    const seeded = await db
      .select({ competitionId: submissions.competitionId })
      .from(submissions)
      .innerJoin(competitions, eq(competitions.id, submissions.competitionId))
      .where(inArray(competitions.slug, slugs));
    for (const plan of SHOWCASE_SUBMISSIONS) {
      const [competition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.slug, plan.competitionSlug));
      expect(competition!.registrationClosesAt.getTime()).toBeLessThan(Date.now());
      expect(competition!.submissionClosesAt.getTime()).toBeGreaterThan(Date.now());
      expect(seeded.filter((row) => row.competitionId === competition!.id)).toHaveLength(
        plan.submissions.length,
      );
    }

    const discussions = await db
      .select({ slug: works.slug, total: count(messages.id) })
      .from(works)
      .leftJoin(messages, eq(messages.channelId, works.channelId))
      .where(eq(works.isDemo, true))
      .groupBy(works.slug);
    expect(discussions.length).toBeGreaterThan(0);
    for (const discussion of discussions) expect(discussion.total).toBeGreaterThanOrEqual(2);

    const [newest] = await db
      .select({ id: works.id, slug: works.slug, createdAt: works.createdAt })
      .from(works)
      .orderBy(desc(works.createdAt))
      .limit(1);
    expect(newest!.slug).toBe("maladies-manioc-vision-mobile");
    const [announcement] = await db.select().from(posts).where(eq(posts.workId, newest!.id));
    expect(announcement!.createdAt).toEqual(newest!.createdAt);
  }, 120_000);
});
