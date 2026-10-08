import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { channels, messages, profiles, spaceMembers, spaces, user } from "./index.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("contraintes du schéma de salons", () => {
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

  async function createSpace(ownerId: string, slug: string) {
    const [space] = await db.insert(spaces).values({ name: slug, slug, createdBy: ownerId }).returning();
    return space!;
  }

  it("refuse deux espaces avec le même identifiant", async () => {
    const owner = await createProfile("space-owner-a");
    await createSpace(owner.id, "doublon");
    await expect(db.insert(spaces).values({ name: "doublon", slug: "doublon", createdBy: owner.id })).rejects.toThrow();
  });

  it("refuse deux fois le même membre dans un espace", async () => {
    const owner = await createProfile("space-owner-b");
    const space = await createSpace(owner.id, "membres");
    await db.insert(spaceMembers).values({ spaceId: space.id, profileId: owner.id, role: "owner" });
    await expect(db.insert(spaceMembers).values({ spaceId: space.id, profileId: owner.id, role: "member" })).rejects.toThrow();
  });

  it("refuse deux salons avec le même identifiant dans un espace", async () => {
    const owner = await createProfile("space-owner-c");
    const space = await createSpace(owner.id, "salons");
    await db.insert(channels).values({ spaceId: space.id, name: "Général", slug: "general" });
    await expect(db.insert(channels).values({ spaceId: space.id, name: "Autre", slug: "general" })).rejects.toThrow();
  });

  it("refuse deux fois le même clientId pour un même auteur", async () => {
    const owner = await createProfile("space-owner-d");
    const space = await createSpace(owner.id, "messages");
    const [channel] = await db.insert(channels).values({ spaceId: space.id, name: "Général", slug: "general" }).returning();
    const clientId = randomUUID();
    await db.insert(messages).values({ channelId: channel!.id, authorId: owner.id, clientId, body: "Salut" });
    await expect(
      db.insert(messages).values({ channelId: channel!.id, authorId: owner.id, clientId, body: "Salut encore" }),
    ).rejects.toThrow();
  });
});
