import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { account, createDb, profiles, reports, session, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Export des données du compte (base Postgres réelle)", () => {
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
    app = buildApp({ db, auth });
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

  async function createMember(email: string, handle: string): Promise<{ cookie: string; userId: string }> {
    const signUp = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
    });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "une-passphrase-solide" } });
    const cookie = extractCookie(signIn);
    await app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload: { handle, displayName: handle, country: "SN" } });
    return { cookie, userId: signUp.json().user.id as string };
  }

  function publish(cookie: string, body: string) {
    return app.inject({ method: "POST", url: "/api/posts", headers: { cookie }, payload: { body } });
  }

  it("refuse l'export à un visiteur", async () => {
    const response = await app.inject({ method: "GET", url: "/api/me/export" });
    expect(response.statusCode).toBe(401);
  });

  it("n'exporte que le compte de la session, en pièce jointe", async () => {
    const amina = await createMember("amina@test.kemet", "amina");
    const kwame = await createMember("kwame@test.kemet", "kwame");
    await publish(amina.cookie, "Post d'Amina");
    await publish(kwame.cookie, "Post de Kwame");

    const response = await app.inject({ method: "GET", url: "/api/me/export", headers: { cookie: amina.cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="kemet-amina-\d{4}-\d{2}-\d{2}\.json"$/);
    const data = response.json();
    expect(data.account.email).toBe("amina@test.kemet");
    expect(data.profile.handle).toBe("amina");
    expect(data.posts.map((post: { body: string }) => post.body)).toEqual(["Post d'Amina"]);
    expect(response.body).not.toContain("Post de Kwame");
    expect(response.body).not.toContain("kwame@test.kemet");
  });

  it("ne contient ni mot de passe ni jeton", async () => {
    const member = await createMember("secret@test.kemet", "secret");
    const [credential] = await db.select().from(account).where(eq(account.userId, member.userId));
    const sessions = await db.select().from(session).where(eq(session.userId, member.userId));

    const response = await app.inject({ method: "GET", url: "/api/me/export", headers: { cookie: member.cookie } });
    expect(response.body).not.toContain(credential!.password!);
    for (const row of sessions) expect(response.body).not.toContain(row.token);
    expect(response.json().sessions.length).toBe(sessions.length);
  });

  it("ne révèle pas quel administrateur a traité un signalement", async () => {
    const reporter = await createMember("reporter@test.kemet", "reporter");
    const admin = await createMember("moderator@test.kemet", "moderator");
    const [reporterProfile] = await db.select().from(profiles).where(eq(profiles.userId, reporter.userId));
    const [adminProfile] = await db.select().from(profiles).where(eq(profiles.userId, admin.userId));
    await db.insert(reports).values({
      reporterId: reporterProfile!.id,
      // Cible sans lien avec l'administrateur : seul `resolvedBy` le désigne.
      targetType: "post",
      targetId: crypto.randomUUID(),
      reason: "Signalement de test",
      status: "dismissed",
      resolvedAt: new Date(),
      resolvedBy: adminProfile!.id,
    });

    const response = await app.inject({ method: "GET", url: "/api/me/export", headers: { cookie: reporter.cookie } });
    expect(response.json().reports).toHaveLength(1);
    expect(response.body).not.toContain(adminProfile!.id);
  });

  it("limite le débit à trois exports par heure", async () => {
    const member = await createMember("debit@test.kemet", "debit");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await app.inject({ method: "GET", url: "/api/me/export", headers: { cookie: member.cookie } });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});
