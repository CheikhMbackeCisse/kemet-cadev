import { eq } from "drizzle-orm";
import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Modération (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
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

  function extractVerificationUrl(email: string): string {
    const [message] = emailSender.findByRecipient(email);
    const match = message?.html.match(/href="([^"]+)"/);
    if (!match) throw new Error("Email de vérification introuvable.");
    return match[1]!;
  }

  async function createMember(email: string, handle: string): Promise<{ cookie: string; profileId: string }> {
    await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { email, password: "une-passphrase-solide", name: handle } });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "une-passphrase-solide" } });
    const cookie = extractCookie(signIn);
    const me = await app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload: { handle, displayName: handle, country: "SN" } });
    return { cookie, profileId: me.json().profile.id as string };
  }

  async function makeAdmin(profileId: string): Promise<void> {
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, profileId));
  }

  async function createSpace(cookie: string, slug: string) {
    const response = await app.inject({ method: "POST", url: "/api/spaces", headers: { cookie }, payload: { name: slug, slug, visibility: "public" } });
    return response.json().space as { id: string };
  }

  async function generalChannelId(cookie: string, spaceId: string): Promise<string> {
    const response = await app.inject({ method: "GET", url: `/api/spaces/${spaceId}/channels`, headers: { cookie } });
    const channels = response.json().items as { id: string; slug: string }[];
    return channels.find((channel) => channel.slug === "general")!.id;
  }

  async function sendMessage(cookie: string, channelId: string, body: string) {
    const response = await app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie },
      payload: { clientId: crypto.randomUUID(), body },
    });
    return response.json().message as { id: string };
  }

  async function createPost(cookie: string, body: string) {
    const response = await app.inject({ method: "POST", url: "/api/posts", headers: { cookie }, payload: { body } });
    return response.json().post as { id: string };
  }

  async function report(cookie: string, targetType: string, targetId: string, reason = "Contenu inapproprié") {
    return app.inject({ method: "POST", url: "/api/reports", headers: { cookie }, payload: { targetType, targetId, reason } });
  }

  it("crée un signalement, refuse le doublon, l'auto-signalement et une cible introuvable", async () => {
    const author = await createMember("author@test.kemet", "author");
    const reporter = await createMember("reporter@test.kemet", "reporter");
    const space = await createSpace(author.cookie, "modspace");
    const channelId = await generalChannelId(author.cookie, space.id);
    const message = await sendMessage(author.cookie, channelId, "Message problématique");

    const first = await report(reporter.cookie, "message", message.id);
    expect(first.statusCode).toBe(200);

    const duplicate = await report(reporter.cookie, "message", message.id);
    expect(duplicate.statusCode).toBe(409);

    const selfReport = await report(author.cookie, "message", message.id);
    expect(selfReport.statusCode).toBe(400);

    const missing = await report(reporter.cookie, "message", crypto.randomUUID());
    expect(missing.statusCode).toBe(404);
  });

  it("réserve la file de signalements et le journal d'audit aux admins", async () => {
    const member = await createMember("member@test.kemet", "member");
    const pending = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: member.cookie } });
    expect(pending.statusCode).toBe(403);
    const log = await app.inject({ method: "GET", url: "/api/moderation/log", headers: { cookie: member.cookie } });
    expect(log.statusCode).toBe(403);
  });

  it("masque un message signalé, referme les doublons et journalise l'action", async () => {
    const author = await createMember("author2@test.kemet", "author2");
    const reporterA = await createMember("reportera@test.kemet", "reportera");
    const reporterB = await createMember("reporterb@test.kemet", "reporterb");
    const admin = await createMember("admin@test.kemet", "admin");
    await makeAdmin(admin.profileId);

    const space = await createSpace(author.cookie, "hidespace");
    const channelId = await generalChannelId(author.cookie, space.id);
    const message = await sendMessage(author.cookie, channelId, "Message à masquer");

    const reportA = (await report(reporterA.cookie, "message", message.id)).json().report;
    await report(reporterB.cookie, "message", message.id);

    const resolved = await app.inject({
      method: "PUT",
      url: `/api/reports/${reportA.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "hide" },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().report.status).toBe("resolved");

    const history = await app.inject({ method: "GET", url: `/api/channels/${channelId}/messages`, headers: { cookie: author.cookie } });
    const ids = (history.json().items as { id: string }[]).map((item) => item.id);
    expect(ids).not.toContain(message.id);

    const remainingQueue = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: admin.cookie } });
    expect(remainingQueue.json().items).toHaveLength(0);

    const log = await app.inject({ method: "GET", url: "/api/moderation/log", headers: { cookie: admin.cookie } });
    const entries = log.json().items as { action: string }[];
    expect(entries.some((entry) => entry.action === "content_hidden")).toBe(true);
  });

  it("suspend un compte signalé et bloque ses écritures jusqu'à réintégration", async () => {
    const target = await createMember("target@test.kemet", "target");
    const reporter = await createMember("reporterc@test.kemet", "reporterc");
    const admin = await createMember("admin2@test.kemet", "admin2");
    await makeAdmin(admin.profileId);

    const flagged = (await report(reporter.cookie, "profile", target.profileId)).json().report;

    const resolved = await app.inject({
      method: "PUT",
      url: `/api/reports/${flagged.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "suspend" },
    });
    expect(resolved.statusCode).toBe(200);

    const blockedPost = await app.inject({ method: "POST", url: "/api/posts", headers: { cookie: target.cookie }, payload: { body: "Je ne devrais plus pouvoir publier." } });
    expect(blockedPost.statusCode).toBe(403);

    const reinstated = await app.inject({
      method: "POST",
      url: "/api/profiles/target/reinstate",
      headers: { cookie: admin.cookie },
    });
    expect(reinstated.statusCode).toBe(200);

    const allowedPost = await app.inject({ method: "POST", url: "/api/posts", headers: { cookie: target.cookie }, payload: { body: "De retour." } });
    expect(allowedPost.statusCode).toBe(200);
  });

  it("bloque aussi la modification du profil d'un compte suspendu", async () => {
    const target = await createMember("target3@test.kemet", "target3");
    const reporter = await createMember("reporterf@test.kemet", "reporterf");
    const admin = await createMember("admin5@test.kemet", "admin5");
    await makeAdmin(admin.profileId);
    const flagged = (await report(reporter.cookie, "profile", target.profileId)).json().report;
    await app.inject({ method: "PUT", url: `/api/reports/${flagged.id}/resolve`, headers: { cookie: admin.cookie }, payload: { action: "suspend" } });

    const blockedUpdate = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: target.cookie },
      payload: { displayName: "Nouveau nom" },
    });
    expect(blockedUpdate.statusCode).toBe(403);
  });

  it("refuse de signaler ou de voir le contenu d'un message d'un espace privé dont on n'est pas membre", async () => {
    const owner = await createMember("privowner@test.kemet", "privowner");
    const outsider = await createMember("outsider2@test.kemet", "outsider2");
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: owner.cookie },
      payload: { name: "privspace", slug: "privspace", visibility: "private" },
    });
    const channelId = await generalChannelId(owner.cookie, space.json().space.id);
    const message = await sendMessage(owner.cookie, channelId, "Message privé");

    const blockedReport = await report(outsider.cookie, "message", message.id);
    expect(blockedReport.statusCode).toBe(404);
  });

  it("rejette seulement le signalement traité par dismiss, sans toucher au contenu", async () => {
    const author = await createMember("author3@test.kemet", "author3");
    const reporter = await createMember("reporterd@test.kemet", "reporterd");
    const admin = await createMember("admin3@test.kemet", "admin3");
    await makeAdmin(admin.profileId);
    const post = await createPost(author.cookie, "Post finalement correct.");
    const flagged = (await report(reporter.cookie, "post", post.id)).json().report;

    const resolved = await app.inject({
      method: "PUT",
      url: `/api/reports/${flagged.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "dismiss", reason: "Rien d'anormal." },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().report.status).toBe("dismissed");

    const read = await app.inject({ method: "GET", url: `/api/posts/${post.id}` });
    expect(read.json().post.deletedAt).toBeNull();
  });

  it("refuse une action incompatible avec le type de cible", async () => {
    const target = await createMember("target2@test.kemet", "target2");
    const reporter = await createMember("reportere@test.kemet", "reportere");
    const admin = await createMember("admin4@test.kemet", "admin4");
    await makeAdmin(admin.profileId);
    const flagged = (await report(reporter.cookie, "profile", target.profileId)).json().report;

    const mismatched = await app.inject({
      method: "PUT",
      url: `/api/reports/${flagged.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "hide" },
    });
    expect(mismatched.statusCode).toBe(400);
  });
});
