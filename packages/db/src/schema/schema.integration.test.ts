import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { follows, posts, profiles, user } from "./index.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("contraintes du schéma", () => {
  const db = createDb(databaseUrl ?? "");

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
  });

  async function createProfile(handle: string) {
    const userId = randomUUID();
    await db.insert(user).values({ id: userId, name: handle, email: `${handle}@test.kemet` });
    const [profile] = await db
      .insert(profiles)
      .values({ userId, handle, displayName: handle, country: "SN" })
      .returning();
    return profile!;
  }

  it("refuse deux profils avec le même identifiant", async () => {
    await createProfile("unique-handle");
    await expect(createProfile("unique-handle")).rejects.toThrow();
  });

  it("refuse qu'un profil se suive lui-même", async () => {
    const profile = await createProfile("self-follow-test");
    await expect(
      db.insert(follows).values({ followerId: profile.id, followeeId: profile.id }),
    ).rejects.toThrow();
  });

  it("refuse deux fois le même suivi", async () => {
    const a = await createProfile("follow-a");
    const b = await createProfile("follow-b");
    await db.insert(follows).values({ followerId: a.id, followeeId: b.id });
    await expect(db.insert(follows).values({ followerId: a.id, followeeId: b.id })).rejects.toThrow();
  });

  it("refuse un post sans texte qui n'est pas un partage", async () => {
    const author = await createProfile("post-empty");
    await expect(db.insert(posts).values({ authorId: author.id, body: "" })).rejects.toThrow();
  });

  it("accepte un partage sans texte", async () => {
    const author = await createProfile("post-share-empty");
    const [original] = await db.insert(posts).values({ authorId: author.id, body: "Un post original." }).returning();
    await expect(
      db.insert(posts).values({ authorId: author.id, body: "", sharedPostId: original!.id }),
    ).resolves.not.toThrow();
  });

  it("refuse un lien de démo sur un post qui n'est pas de format À tester", async () => {
    const author = await createProfile("post-test-url-wrong-format");
    await expect(
      db.insert(posts).values({ authorId: author.id, body: "Un post.", testUrl: "https://example.com" }),
    ).rejects.toThrow();
  });

  it("accepte un lien de démo sur un post de format À tester", async () => {
    const author = await createProfile("post-test-url-right-format");
    await expect(
      db
        .insert(posts)
        .values({ authorId: author.id, body: "Un post.", format: "a_tester", testUrl: "https://example.com" }),
    ).resolves.not.toThrow();
  });
});
