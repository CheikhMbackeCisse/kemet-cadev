import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "../api/app.js";
import { canAccessChannel, findProfileId } from "./access.js";

const databaseUrl = getTestDatabaseUrl();

// `canAccessChannel` et `findProfileId` décident qui peut rejoindre une room
// Socket.IO (apps/server/src/realtime/main.ts). Testés ici directement
// contre une vraie base plutôt qu'en pilotant un client Socket.IO, qu'aucun
// test de ce dépôt n'exerce encore (voir docs/adr/0014-comptes-et-visiteur.md).
describe.skipIf(!databaseUrl)("Accès aux salons en temps réel (base Postgres réelle)", () => {
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
    app = buildApp({ db, auth });
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

  async function createMember(email: string, handle: string): Promise<{ cookie: string; userId: string; profileId: string }> {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "une-passphrase-solide" } });
    const cookie = extractCookie(signIn);
    const profile = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    return { cookie, userId: me.json().user.id as string, profileId: profile.json().profile.id as string };
  }

  async function createSpace(cookie: string, slug: string, visibility: "public" | "private") {
    const response = await app.inject({ method: "POST", url: "/api/spaces", headers: { cookie }, payload: { name: slug, slug, visibility } });
    return response.json().space.id as string;
  }

  async function generalChannelId(cookie: string, spaceId: string): Promise<string> {
    const response = await app.inject({ method: "GET", url: `/api/spaces/${spaceId}/channels`, headers: { cookie } });
    return response.json().items.find((channel: { slug: string }) => channel.slug === "general").id as string;
  }

  it("retrouve le profil d'un utilisateur connecté", async () => {
    const owner = await createMember("rt-owner@test.kemet", "rtowner");
    expect(await findProfileId(db, owner.userId)).toBe(owner.profileId);
  });

  it("ne retrouve aucun profil pour un utilisateur sans profil complété", async () => {
    expect(await findProfileId(db, crypto.randomUUID())).toBeNull();
  });

  it("ouvre un salon public à n'importe qui, membre ou visiteur", async () => {
    const owner = await createMember("rt-owner2@test.kemet", "rtowner2");
    const outsider = await createMember("rt-outsider@test.kemet", "rtoutsider");
    const spaceId = await createSpace(owner.cookie, "rt-public-space", "public");
    const channelId = await generalChannelId(owner.cookie, spaceId);

    expect(await canAccessChannel(db, owner.profileId, channelId)).toBe(true);
    expect(await canAccessChannel(db, outsider.profileId, channelId)).toBe(true);
    expect(await canAccessChannel(db, null, channelId)).toBe(true);
  });

  it("réserve un salon privé à ses membres, refuse un visiteur", async () => {
    const owner = await createMember("rt-owner3@test.kemet", "rtowner3");
    const outsider = await createMember("rt-outsider2@test.kemet", "rtoutsider2");
    const spaceId = await createSpace(owner.cookie, "rt-private-space", "private");
    const channelId = await generalChannelId(owner.cookie, spaceId);

    expect(await canAccessChannel(db, owner.profileId, channelId)).toBe(true);
    expect(await canAccessChannel(db, outsider.profileId, channelId)).toBe(false);
    expect(await canAccessChannel(db, null, channelId)).toBe(false);
  });

  it("refuse un salon qui n'existe pas", async () => {
    expect(await canAccessChannel(db, null, crypto.randomUUID())).toBe(false);
  });
});
