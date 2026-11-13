import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  BEGINNERS_SPACE_ID,
  createDb,
  feedPinnedPosts,
  posts,
  profiles,
  spaces,
  type Db,
} from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

interface FeedItem {
  id: string;
  body: string;
  pinned?: boolean;
}

describe.skipIf(!databaseUrl)("Posts épinglés en tête du fil et espaces mis en avant", () => {
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

  async function signUp(handle: string): Promise<string> {
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
    const raw = signIn.headers["set-cookie"];
    const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    expect(response.statusCode).toBe(200);
    return cookie;
  }

  async function createAuthor(): Promise<string> {
    const [row] = await db
      .insert(profiles)
      .values({
        userId: null,
        handle: "organisation-test",
        displayName: "Organisation",
        country: "",
        isDemo: true,
        onboardingCompletedAt: new Date(),
      })
      .returning({ id: profiles.id });
    return row!.id;
  }

  async function createPost(
    authorId: string,
    body: string,
    values: Partial<typeof posts.$inferInsert> = {},
  ) {
    const [row] = await db
      .insert(posts)
      .values({ authorId, body, ...values })
      .returning({ id: posts.id });
    return row!.id;
  }

  async function feed(cookie?: string): Promise<FeedItem[]> {
    const response = await app.inject({
      method: "GET",
      url: "/api/posts?tab=pour-toi",
      headers: cookie ? { cookie } : {},
    });
    expect(response.statusCode).toBe(200);
    return response.json().items;
  }

  it("ouvre le fil Pour toi sur les posts épinglés, dans leur ordre, pour un visiteur comme pour un compte", async () => {
    const authorId = await createAuthor();
    const second = await createPost(authorId, "Question Wave", {
      createdAt: new Date(Date.now() - 86_400_000),
    });
    const first = await createPost(authorId, "La CADEV 2026 en bref", {
      createdAt: new Date(Date.now() - 3 * 86_400_000),
    });
    await createPost(authorId, "Un post récent");
    await db.insert(feedPinnedPosts).values([
      { postId: first, position: 0 },
      { postId: second, position: 1 },
    ]);
    const cookie = await signUp("lectrice");

    for (const items of [await feed(), await feed(cookie)]) {
      expect(items.map((item) => item.body)).toEqual([
        "La CADEV 2026 en bref",
        "Question Wave",
        "Un post récent",
      ]);
      expect(items.map((item) => item.pinned)).toEqual([true, true, false]);
    }
  });

  it("n'épingle jamais un post d'espace privé ni un post supprimé", async () => {
    const authorId = await createAuthor();
    const [privateSpace] = await db
      .insert(spaces)
      .values({ name: "Privé", slug: "prive", visibility: "private", createdBy: authorId })
      .returning({ id: spaces.id });
    const secret = await createPost(authorId, "Post d'un espace privé", {
      spaceId: privateSpace!.id,
    });
    const removed = await createPost(authorId, "Post supprimé", { deletedAt: new Date() });
    await db.insert(feedPinnedPosts).values([
      { postId: secret, position: 0 },
      { postId: removed, position: 1 },
    ]);
    const cookie = await signUp("curieux");

    for (const items of [await feed(), await feed(cookie)]) {
      const bodies = items.map((item) => item.body);
      expect(bodies).not.toContain("Post d'un espace privé");
      expect(bodies).not.toContain("Post supprimé");
    }
  });

  it("place Débuter en informatique puis CADEV 2026 en tête des espaces, même plus anciens", async () => {
    const authorId = await createAuthor();
    await db
      .insert(spaces)
      .values({
        name: "CADEV 2026",
        slug: "cadev-2026",
        createdBy: authorId,
        createdAt: new Date(2020, 0, 1),
      });
    await db
      .insert(spaces)
      .values({ name: "Flutter Afrique", slug: "flutter-afrique", createdBy: authorId });
    const cookie = await signUp("arrivante");

    for (const headers of [{}, { cookie }]) {
      const response = await app.inject({ method: "GET", url: "/api/spaces", headers });
      expect(response.statusCode).toBe(200);
      const items: { id: string; name: string }[] = response.json().items;
      expect(items[0]!.id).toBe(BEGINNERS_SPACE_ID);
      expect(items[1]!.name).toBe("CADEV 2026");
      expect(items.filter((item) => item.name === "CADEV 2026")).toHaveLength(1);
    }
  });
});
