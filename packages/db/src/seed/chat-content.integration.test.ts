import { eq, like } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { messages, spaces } from "../schema/index.js";
import { seedDemoDataset } from "./demo-dataset.js";
import {
  CADEV_SPACE_DESCRIPTION,
  CADEV_WELCOME_OPENING,
  renameCadevSpace,
} from "./chat-content.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("espace CADEV 2026", () => {
  const db = createDb(databaseUrl ?? "");

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
    await seedDemoDataset(db);
  }, 120_000);

  it("remplace les anciens textes d'une base déjà remplie, une seule fois", async () => {
    await db
      .update(spaces)
      .set({
        description: "Espace officiel de la compétition CADEV 2026, organisée par Systalink.",
      })
      .where(eq(spaces.slug, "cadev-2026"));
    const [welcome] = await db
      .select({ id: messages.id, body: messages.body })
      .from(messages)
      .where(like(messages.body, `${CADEV_WELCOME_OPENING}%`));
    const oldBody = welcome!.body.replace(
      CADEV_WELCOME_OPENING,
      "Bienvenue sur l'espace officiel de CADEV 2026 !",
    );
    await db.update(messages).set({ body: oldBody }).where(eq(messages.id, welcome!.id));

    expect(await renameCadevSpace(db)).toEqual({ spaces: 1, messages: 1 });
    expect(await renameCadevSpace(db)).toEqual({ spaces: 0, messages: 0 });

    const [space] = await db.select().from(spaces).where(eq(spaces.slug, "cadev-2026"));
    expect(space!.description).toBe(CADEV_SPACE_DESCRIPTION);
    const [message] = await db.select().from(messages).where(eq(messages.id, welcome!.id));
    expect(message!.body).toBe(welcome!.body);
  });

  it("ne touche pas une description changée depuis", async () => {
    await db
      .update(spaces)
      .set({ description: "Texte choisi par la propriétaire." })
      .where(eq(spaces.slug, "cadev-2026"));

    expect((await renameCadevSpace(db)).spaces).toBe(0);
    const [space] = await db.select().from(spaces).where(eq(spaces.slug, "cadev-2026"));
    expect(space!.description).toBe("Texte choisi par la propriétaire.");
  });
});
