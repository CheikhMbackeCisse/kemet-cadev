import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, messages, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

interface MessagePage {
  items: { id: string }[];
  nextCursor: string | null;
  firstUnreadMessageId: string | null;
}

describe.skipIf(!databaseUrl)("Historique paginé d'un salon (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let db: Db;
  let emailSender: InMemoryEmailSender;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth, chat: createNoopChatPublisher() });
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(handle: string): Promise<{ cookie: string; profileId: string }> {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const cookie = extractCookie(signIn);
    const profile = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: profile.json().profile.id };
  }

  async function createSpaceWithGeneral(
    cookie: string,
    slug: string,
    visibility: "public" | "private",
  ) {
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie },
      payload: { name: slug, slug, visibility },
    });
    const spaceId = space.json().space.id as string;
    const channels = await app.inject({
      method: "GET",
      url: `/api/spaces/${spaceId}/channels`,
      headers: { cookie },
    });
    const items = channels.json().items as { id: string; slug: string }[];
    return {
      spaceId,
      generalId: items.find((channel) => channel.slug === "general")!.id,
      memesId: items.find((channel) => channel.slug === "memes")!.id,
    };
  }

  // Insertion directe : la limite d'envoi d'un compte neuf (quelques messages
  // par minute) empêcherait de construire un historique par la route, et
  // seule la base permet de poser deux messages au même horodatage.
  async function insertMessages(channelId: string, authorId: string, createdAts: Date[]) {
    const rows = await db
      .insert(messages)
      .values(
        createdAts.map((createdAt, index) => ({
          channelId,
          authorId,
          clientId: crypto.randomUUID(),
          body: `Message ${index}`,
          createdAt,
        })),
      )
      .returning({ id: messages.id, createdAt: messages.createdAt });
    return rows;
  }

  async function getPage(channelId: string, query: string, cookie?: string) {
    return app.inject({
      method: "GET",
      url: `/api/channels/${channelId}/messages${query}`,
      headers: cookie ? { cookie } : {},
    });
  }

  it("parcourt tout l'historique par curseur, sans perte ni doublon, même à horodatage égal", async () => {
    const owner = await createMember("historyowner");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "history", "public");
    const base = Date.now() - 60_000;
    const tie = new Date(base + 2_000);
    const inserted = await insertMessages(generalId, owner.profileId, [
      new Date(base),
      new Date(base + 1_000),
      tie,
      tie,
      new Date(base + 3_000),
    ]);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await getPage(
        generalId,
        `?limit=2${cursor ? `&cursor=${cursor}` : ""}`,
        owner.cookie,
      );
      expect(response.statusCode).toBe(200);
      const page = response.json() as MessagePage;
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);

    const expected = inserted
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
      .map((row) => row.id);
    expect(seen).toEqual(expected);
  });

  it("refuse un curseur qui n'est pas un identifiant de message", async () => {
    const owner = await createMember("cursorowner");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "cursor", "public");
    const response = await getPage(
      generalId,
      `?cursor=${encodeURIComponent(new Date().toISOString())}`,
      owner.cookie,
    );
    expect(response.statusCode).toBe(400);
  });

  it("ne renvoie rien d'un autre salon quand le curseur en vient", async () => {
    const owner = await createMember("crossowner");
    const { generalId, memesId } = await createSpaceWithGeneral(owner.cookie, "cross", "public");
    await insertMessages(generalId, owner.profileId, [new Date(Date.now() - 10_000)]);
    const [foreign] = await insertMessages(memesId, owner.profileId, [new Date()]);

    const response = await getPage(generalId, `?cursor=${foreign!.id}`, owner.cookie);
    expect(response.statusCode).toBe(200);
    expect((response.json() as MessagePage).items).toEqual([]);
  });

  it("cache les pages suivantes d'un salon privé à qui n'en est pas membre, connecté ou non", async () => {
    const owner = await createMember("privateowner");
    const outsider = await createMember("privateoutsider");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "private-history", "private");
    const [oldest, newest] = await insertMessages(generalId, owner.profileId, [
      new Date(Date.now() - 10_000),
      new Date(),
    ]);
    expect(oldest).toBeDefined();

    const asOwner = await getPage(generalId, `?cursor=${newest!.id}`, owner.cookie);
    expect(asOwner.statusCode).toBe(200);
    expect((asOwner.json() as MessagePage).items.map((item) => item.id)).toEqual([oldest!.id]);

    expect((await getPage(generalId, `?cursor=${newest!.id}`, outsider.cookie)).statusCode).toBe(
      404,
    );
    expect((await getPage(generalId, `?cursor=${newest!.id}`)).statusCode).toBe(404);
  });

  it("indique le premier message non lu d'un membre, jamais à un visiteur ni à un non-membre", async () => {
    const owner = await createMember("unreadowner");
    const reader = await createMember("unreadreader");
    const passerby = await createMember("unreadpasserby");
    const { spaceId, generalId } = await createSpaceWithGeneral(owner.cookie, "unread", "public");
    await app.inject({
      method: "POST",
      url: `/api/spaces/${spaceId}/members`,
      headers: { cookie: owner.cookie },
      payload: { handle: "unreadreader" },
    });

    const [beforeJoin] = await insertMessages(generalId, owner.profileId, [
      new Date(Date.now() - 60_000),
    ]);
    // Juste après l'arrivée dans l'espace, et avant la lecture marquée plus bas.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const [afterJoin] = await insertMessages(generalId, owner.profileId, [new Date()]);
    const firstOpen = (await getPage(generalId, "", reader.cookie)).json() as MessagePage;
    expect(firstOpen.firstUnreadMessageId).toBe(afterJoin!.id);
    expect(firstOpen.firstUnreadMessageId).not.toBe(beforeJoin!.id);

    await app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/read`,
      headers: { cookie: reader.cookie },
      payload: { messageId: afterJoin!.id },
    });
    const [later] = await insertMessages(generalId, owner.profileId, [
      new Date(Date.now() + 5_000),
    ]);
    const secondOpen = (await getPage(generalId, "", reader.cookie)).json() as MessagePage;
    expect(secondOpen.firstUnreadMessageId).toBe(later!.id);

    const olderPage = (
      await getPage(generalId, `?cursor=${later!.id}`, reader.cookie)
    ).json() as MessagePage;
    expect(olderPage.firstUnreadMessageId).toBeNull();

    expect(
      ((await getPage(generalId, "", passerby.cookie)).json() as MessagePage).firstUnreadMessageId,
    ).toBeNull();
    expect(((await getPage(generalId, "")).json() as MessagePage).firstUnreadMessageId).toBeNull();
  });
});
