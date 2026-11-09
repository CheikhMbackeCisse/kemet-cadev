import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  account,
  channels,
  createDb,
  follows,
  posts,
  profiles,
  spaceMembers,
  user,
  type Db,
} from "@kemet/db";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const FILLER_EMAIL = "figurant@test.kemet";
const FILLER_HANDLE = "figurant-temoin";
const FILLER_NAME = "Figurant Témoin";
const FILLER_POST = "Un post écrit par le figurant.";

describe.skipIf(!databaseUrl)("Figurants invisibles (base Postgres réelle)", () => {
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
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    expect(response.statusCode).toBe(200);
    return { cookie, profileId: response.json().profile.id };
  }

  // Même forme que les figurants du seed : un utilisateur sans aucun compte
  // de connexion, un profil marqué.
  async function createFiller(): Promise<string> {
    await db
      .insert(user)
      .values({ id: "filler-user", name: FILLER_NAME, email: FILLER_EMAIL, emailVerified: true });
    const [row] = await db
      .insert(profiles)
      .values({
        userId: "filler-user",
        handle: FILLER_HANDLE,
        displayName: FILLER_NAME,
        country: "SN",
        isDemo: true,
        isFiller: true,
        onboardingCompletedAt: new Date(),
      })
      .returning({ id: profiles.id });
    return row!.id;
  }

  it("ne laisse jamais un figurant se connecter, même après une demande de réinitialisation", async () => {
    await createFiller();

    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: FILLER_EMAIL, password: "une-passphrase-solide" },
    });
    expect(signIn.statusCode).toBe(401);

    await app.inject({
      method: "POST",
      url: "/api/auth/request-password-reset",
      payload: {
        email: FILLER_EMAIL,
        redirectTo: "http://localhost:5173/reinitialiser-mot-de-passe",
      },
    });
    await vi.waitFor(() => expect(emailSender.findByRecipient(FILLER_EMAIL)).toHaveLength(1));
    const [message] = emailSender.findByRecipient(FILLER_EMAIL);
    const token = message!.html.match(/reset-password\/([^?"]+)/)![1]!;

    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/reset-password",
      payload: { token, newPassword: "une-passphrase-solide" },
    });
    expect(reset.statusCode).toBe(403);
    expect(await db.select().from(account).where(eq(account.userId, "filler-user"))).toEqual([]);

    const afterReset = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: FILLER_EMAIL, password: "une-passphrase-solide" },
    });
    expect(afterReset.statusCode).toBe(401);
  });

  it("ne renvoie le figurant sur aucune route, mais le compte dans les totaux", async () => {
    const owner = await createMember("hote");
    const viewer = await createMember("lectrice");
    const fillerId = await createFiller();

    const spaceResponse = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: owner.cookie },
      payload: { name: "CADEV 2026", slug: "cadev-2026", visibility: "public" },
    });
    const spaceId = spaceResponse.json().space.id as string;
    await app.inject({
      method: "POST",
      url: `/api/spaces/${spaceId}/join`,
      headers: { cookie: viewer.cookie },
    });
    await db.insert(spaceMembers).values({ spaceId, profileId: fillerId, role: "member" });
    await db.insert(follows).values([
      { followerId: fillerId, followeeId: owner.profileId },
      { followerId: owner.profileId, followeeId: fillerId },
      { followerId: viewer.profileId, followeeId: fillerId },
    ]);
    const [fillerPost] = await db
      .insert(posts)
      .values({ authorId: fillerId, body: FILLER_POST })
      .returning({ id: posts.id });
    const [general] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.spaceId, spaceId), eq(channels.slug, "general")));

    const responses: { label: string; status: number; body: string }[] = [];
    async function call(
      label: string,
      method: "GET" | "POST",
      url: string,
      cookie?: string,
      payload?: object,
    ) {
      const response = await app.inject({
        method,
        url,
        headers: cookie ? { cookie } : {},
        payload,
      });
      responses.push({ label, status: response.statusCode, body: response.body });
      return response;
    }

    const ownerProfile = await call("profil public", "GET", "/api/users/hote");
    expect(ownerProfile.json().followerCount).toBe(1);
    expect(ownerProfile.json().followingCount).toBe(1);
    const followers = await call("abonnés", "GET", "/api/users/hote/followers");
    expect(followers.json()).toMatchObject({ items: [], hiddenCount: 1 });
    const following = await call("abonnements", "GET", "/api/users/hote/following");
    expect(following.json()).toMatchObject({ items: [], hiddenCount: 1 });

    expect(
      (await call("profil du figurant", "GET", `/api/users/${FILLER_HANDLE}`)).statusCode,
    ).toBe(404);
    expect(
      (await call("abonnés du figurant", "GET", `/api/users/${FILLER_HANDLE}/followers`))
        .statusCode,
    ).toBe(404);
    expect((await call("post du figurant", "GET", `/api/posts/${fillerPost!.id}`)).statusCode).toBe(
      404,
    );
    expect(
      (
        await call(
          "suivre le figurant",
          "POST",
          `/api/users/${FILLER_HANDLE}/follow`,
          viewer.cookie,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call("écrire au figurant", "POST", "/api/conversations", viewer.cookie, {
          handles: [FILLER_HANDLE],
          body: "Bonjour",
        })
      ).statusCode,
    ).toBe(404);

    expect(
      (
        await call("ajouter le figurant", "POST", `/api/spaces/${spaceId}/members`, owner.cookie, {
          handle: FILLER_HANDLE,
        })
      ).statusCode,
    ).toBe(404);

    const space = await call("espace", "GET", `/api/spaces/${spaceId}`, viewer.cookie);
    expect(space.json().space.memberCount).toBe(3);
    const members = await call("membres", "GET", `/api/spaces/${spaceId}/members`, viewer.cookie);
    expect(members.statusCode).toBe(200);
    await call("espaces", "GET", "/api/spaces", viewer.cookie);

    await call("fil pour toi (visiteur)", "GET", "/api/posts");
    await call("fil pour toi", "GET", "/api/posts?tab=pour-toi", viewer.cookie);
    await call("fil abonnements", "GET", "/api/posts?tab=abonnements", viewer.cookie);
    await call("personnes à suivre", "GET", "/api/me/onboarding/people", viewer.cookie);
    await call("espaces à rejoindre", "GET", "/api/me/onboarding/spaces", viewer.cookie);
    await call("moi", "GET", "/api/me", viewer.cookie);
    await call("export", "GET", "/api/me/export", viewer.cookie);
    await call("conversations", "GET", "/api/conversations", viewer.cookie);
    await call("travaux", "GET", `/api/works?q=${encodeURIComponent("Figurant")}`);

    const levels = await call("niveaux", "GET", "/api/levels");
    const apprentis = levels
      .json()
      .levels.find((entry: { level: string }) => entry.level === "apprenti");
    expect(apprentis.memberCount).toBe(3);

    // Un 404 reprend l'identifiant demandé par le client, comme pour un
    // identifiant qui n'existe pas : il ne révèle rien de plus.
    for (const response of responses) {
      const secrets = [fillerId, FILLER_NAME, FILLER_EMAIL, FILLER_POST];
      if (response.status !== 404) secrets.push(FILLER_HANDLE);
      for (const secret of secrets) {
        expect(response.body.includes(secret), `${response.label} contient ${secret}`).toBe(false);
      }
    }

    // Le texte d'un message garde « @figurant-temoin » tel qu'écrit : on
    // vérifie seulement qu'il ne devient pas une mention.
    const mention = await app.inject({
      method: "POST",
      url: `/api/channels/${general!.id}/messages`,
      headers: { cookie: viewer.cookie },
      payload: { clientId: crypto.randomUUID(), body: `Bonjour @${FILLER_HANDLE} et @hote` },
    });
    expect(mention.statusCode).toBe(200);
    const history = await app.inject({
      method: "GET",
      url: `/api/channels/${general!.id}/messages`,
      headers: { cookie: viewer.cookie },
    });
    expect(mention.json().message.mentionedHandles).toEqual(["hote"]);
    for (const body of [mention.body, history.body]) {
      expect(body.includes(fillerId)).toBe(false);
      expect(body.includes(FILLER_NAME)).toBe(false);
    }
  });
});
