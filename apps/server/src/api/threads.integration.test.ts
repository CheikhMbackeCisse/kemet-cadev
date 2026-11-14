import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, messages, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

interface MessageItem {
  id: string;
  parentMessageId: string | null;
  replyCount: number;
}

describe.skipIf(!databaseUrl)("Fils de discussion (base Postgres réelle)", () => {
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

  async function reply(cookie: string, channelId: string, parentMessageId: string, body: string) {
    return app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie },
      payload: { clientId: crypto.randomUUID(), body, parentMessageId },
    });
  }

  async function listReplies(parentId: string, cookie?: string) {
    return app.inject({
      method: "GET",
      url: `/api/messages/${parentId}/replies`,
      headers: cookie ? { cookie } : {},
    });
  }

  it("range une réponse dans son fil, hors du fil principal du salon", async () => {
    const owner = await createMember("threadowner");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "threads", "public");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);

    const response = await reply(owner.cookie, generalId, parent!.id, "Une réponse");
    expect(response.statusCode).toBe(200);

    const replies = await listReplies(parent!.id);
    expect(replies.statusCode).toBe(200);
    expect((replies.json().items as MessageItem[]).map((item) => item.parentMessageId)).toEqual([
      parent!.id,
    ]);

    const channel = await app.inject({ method: "GET", url: `/api/channels/${generalId}/messages` });
    const items = channel.json().items as MessageItem[];
    expect(items.map((item) => item.id)).toEqual([parent!.id]);
    expect(items[0]!.replyCount).toBe(1);
  });

  it("retire une réponse supprimée du fil et du nombre de réponses", async () => {
    const owner = await createMember("threaddelete");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "thread-delete", "public");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);
    const kept = (await reply(owner.cookie, generalId, parent!.id, "Reste")).json().message.id;
    const removedId = (await reply(owner.cookie, generalId, parent!.id, "Part")).json().message.id;

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/messages/${removedId}`,
      headers: { cookie: owner.cookie },
    });

    expect(removed.statusCode).toBe(200);
    const replies = await listReplies(parent!.id);
    expect((replies.json().items as MessageItem[]).map((item) => item.id)).toEqual([kept]);
    const channel = await app.inject({ method: "GET", url: `/api/channels/${generalId}/messages` });
    expect((channel.json().items as MessageItem[])[0]!.replyCount).toBe(1);
  });

  it("ne donne plus le fil d'un message supprimé", async () => {
    const owner = await createMember("parentdelete");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "parent-delete", "public");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);
    await reply(owner.cookie, generalId, parent!.id, "Une réponse");

    await app.inject({ method: "DELETE", url: `/api/messages/${parent!.id}`, headers: { cookie: owner.cookie } });

    expect((await listReplies(parent!.id)).statusCode).toBe(404);
  });

  it("refuse un message parent venu d'un autre salon", async () => {
    const owner = await createMember("crossowner");
    const { generalId, memesId } = await createSpaceWithGeneral(owner.cookie, "cross", "public");
    const [parent] = await insertMessages(memesId, owner.profileId, [new Date()]);

    const response = await reply(owner.cookie, generalId, parent!.id, "Mauvais salon");
    expect(response.statusCode).toBe(400);
  });

  it("refuse de répondre à une réponse", async () => {
    const owner = await createMember("nestedowner");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "nested", "public");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);
    const first = await reply(owner.cookie, generalId, parent!.id, "Premier niveau");
    const firstId = first.json().message.id as string;

    const response = await reply(owner.cookie, generalId, firstId, "Deuxième niveau");
    expect(response.statusCode).toBe(400);
  });

  it("ne montre pas un fil d'espace privé, ni ne laisse y répondre, à qui n'en est pas membre", async () => {
    const owner = await createMember("privatethread");
    const outsider = await createMember("threadoutsider");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "hidden", "private");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);

    expect((await listReplies(parent!.id)).statusCode).toBe(404);
    expect((await listReplies(parent!.id, outsider.cookie)).statusCode).toBe(404);
    const response = await reply(outsider.cookie, generalId, parent!.id, "Intrusion");
    expect(response.statusCode).toBe(404);
  });

  it("refuse une réponse sans session", async () => {
    const owner = await createMember("anonthread");
    const { generalId } = await createSpaceWithGeneral(owner.cookie, "anon", "public");
    const [parent] = await insertMessages(generalId, owner.profileId, [new Date()]);

    const response = await app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/messages`,
      payload: { clientId: crypto.randomUUID(), body: "Sans compte", parentMessageId: parent!.id },
    });
    expect(response.statusCode).toBe(401);
  });
});
