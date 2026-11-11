import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { posts, profiles } from "../schema/index.js";
import { seedShowcase } from "./showcase.js";
import { WAVE_SHOWCASE } from "./showcase-content.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("vitrine du fil", () => {
  const db = createDb(databaseUrl ?? "");

  beforeAll(async () => {
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
});
