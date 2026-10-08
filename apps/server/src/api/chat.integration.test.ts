import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Salons et espaces (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
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

  async function createMember(email: string, name: string, handle: string): Promise<string> {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name },
    });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const cookie = extractCookie(signIn);
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: name, country: "SN" },
    });
    return cookie;
  }

  async function createSpace(cookie: string, slug: string, visibility: "public" | "private" = "public") {
    const response = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie },
      payload: { name: slug, slug, visibility },
    });
    return response.json().space as { id: string };
  }

  async function listChannels(cookie: string, spaceId: string) {
    const response = await app.inject({ method: "GET", url: `/api/spaces/${spaceId}/channels`, headers: { cookie } });
    return response.json().items as { id: string; slug: string }[];
  }

  it("crée un espace avec les deux salons par défaut", async () => {
    const owner = await createMember("owner@test.kemet", "Owner", "owner");
    const space = await createSpace(owner, "backend");
    const channels = await listChannels(owner, space.id);
    expect(channels.map((c) => c.slug).sort()).toEqual(["general", "memes"]);
  });

  it("cache un espace privé à qui n'en est pas membre", async () => {
    const owner = await createMember("owner2@test.kemet", "Owner", "owner2");
    const outsider = await createMember("outsider@test.kemet", "Outsider", "outsider");
    const space = await createSpace(owner, "secret", "private");

    const asOutsider = await app.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: { cookie: outsider } });
    expect(asOutsider.statusCode).toBe(404);

    const channels = await listChannels(owner, space.id);
    const generalChannel = channels.find((c) => c.slug === "general")!;
    const messageAttempt = await app.inject({
      method: "POST",
      url: `/api/channels/${generalChannel.id}/messages`,
      headers: { cookie: outsider },
      payload: { clientId: crypto.randomUUID(), body: "Coucou" },
    });
    expect(messageAttempt.statusCode).toBe(404);
  });

  it("envoie un message, extrait les mentions et déduplique par clientId", async () => {
    const owner = await createMember("owner3@test.kemet", "Owner", "owner3");
    await createMember("friend@test.kemet", "Friend", "friend");
    const space = await createSpace(owner, "general-space");
    await app.inject({
      method: "POST",
      url: `/api/spaces/${space.id}/members`,
      headers: { cookie: owner },
      payload: { handle: "friend" },
    });
    const channels = await listChannels(owner, space.id);
    const generalChannel = channels.find((c) => c.slug === "general")!;

    const clientId = crypto.randomUUID();
    const first = await app.inject({
      method: "POST",
      url: `/api/channels/${generalChannel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId, body: "Salut @friend" },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json().message;
    expect(firstBody.mentionedHandles).toEqual(["friend"]);

    const retry = await app.inject({
      method: "POST",
      url: `/api/channels/${generalChannel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId, body: "Salut @friend" },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().message.id).toBe(firstBody.id);

    const history = await app.inject({ method: "GET", url: `/api/channels/${generalChannel.id}/messages`, headers: { cookie: owner } });
    expect(history.json().items).toHaveLength(1);
  });

  it("bascule une réaction", async () => {
    const owner = await createMember("owner4@test.kemet", "Owner", "owner4");
    const space = await createSpace(owner, "reactions-space");
    const channels = await listChannels(owner, space.id);
    const generalChannel = channels.find((c) => c.slug === "general")!;
    const sent = await app.inject({
      method: "POST",
      url: `/api/channels/${generalChannel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "Un message" },
    });
    const messageId = sent.json().message.id;

    const reacted = await app.inject({
      method: "PUT",
      url: `/api/messages/${messageId}/reactions`,
      headers: { cookie: owner },
      payload: { emoji: "👍" },
    });
    expect(reacted.json().reactions).toEqual([{ emoji: "👍", profileIds: [expect.any(String)] }]);

    const unreacted = await app.inject({
      method: "PUT",
      url: `/api/messages/${messageId}/reactions`,
      headers: { cookie: owner },
      payload: { emoji: "👍" },
    });
    expect(unreacted.json().reactions).toEqual([]);
  });

  it("gère un lien d'invitation valide, puis révoqué", async () => {
    const owner = await createMember("owner5@test.kemet", "Owner", "owner5");
    const joiner = await createMember("joiner@test.kemet", "Joiner", "joiner");
    const space = await createSpace(owner, "invite-space", "private");

    const invite = await app.inject({
      method: "POST",
      url: `/api/spaces/${space.id}/invites`,
      headers: { cookie: owner },
      payload: { expiresInDays: 7 },
    });
    const code = invite.json().invite.code as string;

    const preview = await app.inject({ method: "GET", url: `/api/invites/${code}` });
    expect(preview.json().status).toBe("valid");

    const accept = await app.inject({ method: "POST", url: `/api/invites/${code}/accept`, headers: { cookie: joiner } });
    expect(accept.json()).toMatchObject({ joined: true, status: "ok" });

    const accessAfterJoin = await app.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: { cookie: joiner } });
    expect(accessAfterJoin.statusCode).toBe(200);

    await app.inject({
      method: "DELETE",
      url: `/api/invites/${invite.json().invite.id}`,
      headers: { cookie: owner },
    });
    const previewAfterRevoke = await app.inject({ method: "GET", url: `/api/invites/${code}` });
    expect(previewAfterRevoke.json().status).toBe("revoked");
  });

  it("refuse un lien d'invitation à usage unique une fois épuisé, même sous accès concurrent", async () => {
    const owner = await createMember("owner7@test.kemet", "Owner", "owner7");
    const first = await createMember("first-joiner@test.kemet", "First", "firstjoiner");
    const second = await createMember("second-joiner@test.kemet", "Second", "secondjoiner");
    const space = await createSpace(owner, "limited-invite-space", "private");

    const invite = await app.inject({
      method: "POST",
      url: `/api/spaces/${space.id}/invites`,
      headers: { cookie: owner },
      payload: { expiresInDays: 7, maxUses: 1 },
    });
    const code = invite.json().invite.code as string;

    const [firstAttempt, secondAttempt] = await Promise.all([
      app.inject({ method: "POST", url: `/api/invites/${code}/accept`, headers: { cookie: first } }),
      app.inject({ method: "POST", url: `/api/invites/${code}/accept`, headers: { cookie: second } }),
    ]);
    const results = [firstAttempt.json(), secondAttempt.json()];
    expect(results.filter((result) => result.joined)).toHaveLength(1);
    expect(results.filter((result) => !result.joined && result.status === "exhausted")).toHaveLength(1);

    const previewAfterUse = await app.inject({ method: "GET", url: `/api/invites/${code}` });
    expect(previewAfterUse.json().status).toBe("exhausted");
  });

  it("retire immédiatement l'accès d'un membre exclu", async () => {
    const owner = await createMember("owner6@test.kemet", "Owner", "owner6");
    const member = await createMember("member@test.kemet", "Member", "member");
    const space = await createSpace(owner, "kick-space", "private");
    await app.inject({
      method: "POST",
      url: `/api/spaces/${space.id}/members`,
      headers: { cookie: owner },
      payload: { handle: "member" },
    });

    const beforeKick = await app.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: { cookie: member } });
    expect(beforeKick.statusCode).toBe(200);

    const members = await app.inject({ method: "GET", url: `/api/spaces/${space.id}/members`, headers: { cookie: owner } });
    const memberProfile = members.json().items.find((m: { handle: string }) => m.handle === "member");

    await app.inject({
      method: "DELETE",
      url: `/api/spaces/${space.id}/members/${memberProfile.profileId}`,
      headers: { cookie: owner },
    });

    const afterKick = await app.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: { cookie: member } });
    expect(afterKick.statusCode).toBe(404);
  });
});
