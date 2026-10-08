import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { follows, profiles, user } from "./index.js";

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
});
