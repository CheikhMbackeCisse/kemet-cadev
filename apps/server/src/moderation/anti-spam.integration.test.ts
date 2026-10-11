import { randomUUID } from "node:crypto";
import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "../api/app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Anti-spam : limite réduite pour un compte récent (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let db: ReturnType<typeof createDb>;
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
    // Facteur volontairement bas pour obtenir une limite petite et
    // déterministe (20 messages/minute de base → 4 pour un compte récent)
    // sans attendre une vraie minute entre les requêtes du test.
    app = buildApp({
      db,
      auth,
      chat: createNoopChatPublisher(),
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 0.2 },
    });
  });

  function extractVerificationUrl(email: string): string {
    const [message] = emailSender.findByRecipient(email);
    const match = message?.html.match(/href="([^"]+)"/);
    if (!match) throw new Error("Email de vérification introuvable.");
    return match[1]!;
  }

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(email: string, handle: string): Promise<{ cookie: string; profileId: string }> {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const cookie = extractCookie(signIn);
    const profileResponse = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    const profileId = profileResponse.json().profile.id as string;
    return { cookie, profileId };
  }

  async function createChannel(cookie: string): Promise<string> {
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie },
      payload: { name: "anti-spam", slug: `anti-spam-${randomUUID()}`, visibility: "public" },
    });
    const spaceId = (space.json().space as { id: string }).id;
    const channels = await app.inject({ method: "GET", url: `/api/spaces/${spaceId}/channels`, headers: { cookie } });
    return (channels.json().items as { id: string }[])[0]!.id;
  }

  async function sendMessage(cookie: string, channelId: string) {
    return app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie },
      payload: { clientId: randomUUID(), body: "un message de test" },
    });
  }

  it("bloque un compte flambant neuf bien avant la limite normale", async () => {
    const { cookie } = await createMember("new-account@test.kemet", "newaccount");
    const channelId = await createChannel(cookie);

    const results = [];
    for (let i = 0; i < 5; i += 1) results.push(await sendMessage(cookie, channelId));

    // Base 20/minute × facteur 0.2 = 4 : le cinquième message de ce compte
    // tout juste créé doit être refusé.
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(1);
    expect(results.slice(0, 4).every((r) => r.statusCode === 200)).toBe(true);
  });

  it("laisse passer un compte établi au-delà de la limite d'un compte récent", async () => {
    const { cookie, profileId } = await createMember("established-account@test.kemet", "established");
    const channelId = await createChannel(cookie);

    // Même mécanisme que le vieillissement utilisé pour la fraîcheur des
    // points (lot 8, apps/server/src/ai/assistant-orchestrator.integration.test.ts) :
    // on recule la date de création du profil au-delà de la fenêtre de 24h.
    await db.update(profiles).set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }).where(eq(profiles.id, profileId));

    const results = [];
    for (let i = 0; i < 10; i += 1) results.push(await sendMessage(cookie, channelId));

    expect(results.every((r) => r.statusCode === 200)).toBe(true);
  });
});
