import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, messages, readStates, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

interface SpaceListItem {
  id: string;
  hasUnread: boolean;
}

describe.skipIf(!databaseUrl)("Non-lus d'un espace (base Postgres réelle)", () => {
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

  async function addMember(ownerCookie: string, spaceId: string, handle: string) {
    const response = await app.inject({
      method: "POST",
      url: `/api/spaces/${spaceId}/members`,
      headers: { cookie: ownerCookie },
      payload: { handle },
    });
    expect(response.statusCode).toBe(200);
  }

  async function hasUnreadInList(spaceId: string, cookie?: string) {
    const response = await app.inject({
      method: "GET",
      url: "/api/spaces",
      headers: cookie ? { cookie } : {},
    });
    expect(response.statusCode).toBe(200);
    return (response.json().items as SpaceListItem[]).find((space) => space.id === spaceId)
      ?.hasUnread;
  }

  async function hasUnreadInDetail(spaceId: string, cookie?: string) {
    const response = await app.inject({
      method: "GET",
      url: `/api/spaces/${spaceId}`,
      headers: cookie ? { cookie } : {},
    });
    return response.statusCode === 200 ? (response.json().space.hasUnread as boolean) : null;
  }

  it("signale un message plus récent que la dernière lecture, puis plus rien une fois lu", async () => {
    const owner = await createMember("unreadowner");
    const member = await createMember("unreadmember");
    const { spaceId, generalId } = await createSpaceWithGeneral(owner.cookie, "unread", "public");
    await addMember(owner.cookie, spaceId, "unreadmember");

    expect(await hasUnreadInList(spaceId, member.cookie)).toBe(false);

    const [message] = await insertMessages(generalId, owner.profileId, [
      new Date(Date.now() + 1_000),
    ]);
    expect(await hasUnreadInList(spaceId, member.cookie)).toBe(true);
    expect(await hasUnreadInDetail(spaceId, member.cookie)).toBe(true);

    const read = await app.inject({
      method: "POST",
      url: `/api/channels/${generalId}/read`,
      headers: { cookie: member.cookie },
      payload: { messageId: message!.id },
    });
    expect(read.statusCode).toBe(200);
    // Le message est daté dans le futur pour passer après l'arrivée dans
    // l'espace : la lecture doit l'être aussi.
    await db.update(readStates).set({ lastReadAt: new Date(Date.now() + 2_000) });
    expect(await hasUnreadInList(spaceId, member.cookie)).toBe(false);
  });

  it("ne compte jamais un message supprimé comme non lu", async () => {
    const owner = await createMember("deletedowner");
    const member = await createMember("deletedmember");
    const { spaceId, generalId } = await createSpaceWithGeneral(owner.cookie, "deleted-unread", "public");
    await addMember(owner.cookie, spaceId, "deletedmember");
    const [message] = await insertMessages(generalId, owner.profileId, [new Date(Date.now() + 1_000)]);
    expect(await hasUnreadInList(spaceId, member.cookie)).toBe(true);

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/messages/${message!.id}`,
      headers: { cookie: owner.cookie },
    });

    expect(removed.statusCode).toBe(200);
    expect(await hasUnreadInList(spaceId, member.cookie)).toBe(false);
    const channels = await app.inject({
      method: "GET",
      url: `/api/spaces/${spaceId}/channels`,
      headers: { cookie: member.cookie },
    });
    const general = (channels.json().items as { id: string; unreadCount: number }[]).find(
      (channel) => channel.id === generalId,
    );
    expect(general!.unreadCount).toBe(0);
    const history = await app.inject({
      method: "GET",
      url: `/api/channels/${generalId}/messages`,
      headers: { cookie: member.cookie },
    });
    expect(history.json().items).toEqual([]);
    expect(history.json().firstUnreadMessageId).toBeNull();
  });

  it("ne signale rien à un visiteur ni à un non-membre d'un espace public", async () => {
    const owner = await createMember("publicowner");
    const outsider = await createMember("outsider");
    const { spaceId, generalId } = await createSpaceWithGeneral(owner.cookie, "open", "public");
    await insertMessages(generalId, owner.profileId, [new Date(Date.now() + 1_000)]);

    expect(await hasUnreadInList(spaceId)).toBe(false);
    expect(await hasUnreadInDetail(spaceId)).toBe(false);
    expect(await hasUnreadInList(spaceId, outsider.cookie)).toBe(false);
    expect(await hasUnreadInDetail(spaceId, outsider.cookie)).toBe(false);
  });

  it("ne révèle pas l'activité d'un espace privé à qui n'en est pas membre", async () => {
    const owner = await createMember("privateowner");
    const outsider = await createMember("privateoutsider");
    const { spaceId, generalId } = await createSpaceWithGeneral(owner.cookie, "secret", "private");
    await insertMessages(generalId, owner.profileId, [new Date(Date.now() + 1_000)]);

    expect(await hasUnreadInList(spaceId, outsider.cookie)).toBeUndefined();
    expect(await hasUnreadInDetail(spaceId, outsider.cookie)).toBeNull();
  });

  it("ouvre un visiteur sur l'espace public le plus actif de la semaine, jamais un espace privé", async () => {
    const owner = await createMember("hote-actif");
    const quiet = await createSpaceWithGeneral(owner.cookie, "espace-calme", "public");
    const busy = await createSpaceWithGeneral(owner.cookie, "espace-anime", "public");
    const secret = await createSpaceWithGeneral(owner.cookie, "espace-secret", "private");
    const now = Date.now();
    const recent = (count: number) =>
      Array.from({ length: count }, (_, index) => new Date(now - (index + 1) * 60_000));
    const old = Array.from({ length: 20 }, (_, index) => new Date(now - (10 + index) * 86_400_000));
    await insertMessages(quiet.generalId, owner.profileId, [...recent(1), ...old]);
    await insertMessages(busy.generalId, owner.profileId, recent(3));
    await insertMessages(secret.generalId, owner.profileId, recent(9));

    const response = await app.inject({ method: "GET", url: "/api/spaces/most-active" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ spaceId: busy.spaceId });
  });
});
