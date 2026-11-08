import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, user } from "@kemet/db";
import { DEMO_EMAIL_REJECTED_CODE } from "@kemet/shared";
import { ilike } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("API intégration (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let deps: Parameters<typeof buildApp>[0];

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
      // Désactivé ici : ces tests créent plusieurs comptes en rafale, ce que
      // la limite par défaut de Better Auth sur /sign-up (3 par 10s) refuse.
      // La limite elle-même est vérifiée séparément plus bas.
      rateLimitEnabled: false,
    });
    deps = { db, auth };
    app = buildApp(deps);
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

  async function signUpAndVerify(email: string, name: string): Promise<string> {
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
    return extractCookie(signIn);
  }

  it("pose des en-têtes de sécurité stricts, sans fuite des directives par défaut d'helmet", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    // `useDefaults: false` (apps/server/src/api/app.ts) doit remplacer les
    // directives par défaut d'helmet, pas les fusionner avec defaultSrc :
    // sans lui, l'en-tête réel autorise bien plus que 'none' (font-src
    // 'self' https: data:, frame-ancestors 'self', etc.).
    expect(response.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("expose le contact de confidentialité seulement s'il est configuré", async () => {
    const withoutContact = buildApp({ ...deps, privacyContact: null });
    const empty = await withoutContact.inject({ method: "GET", url: "/api/privacy-contact" });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ contact: null });

    const contact = { name: "Responsable", email: "contact@example.org" };
    const withContact = buildApp({ ...deps, privacyContact: contact });
    const response = await withContact.inject({ method: "GET", url: "/api/privacy-contact" });
    expect(response.json()).toEqual({ contact });
  });

  it("expose la mention de démonstration sans session", async () => {
    const withNotice = buildApp({ ...deps, siteConfig: { demoContentNotice: true } });
    const response = await withNotice.inject({ method: "GET", url: "/api/site-config" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ demoContentNotice: true });
  });

  it("refuse la connexion avant la vérification de l'email", async () => {
    const email = "non-verifie@test.kemet";
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: "Non Vérifié" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("refuse l'accès à /api/me sans session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/me" });
    expect(response.statusCode).toBe(401);
  });

  it("crée le profil puis le relit via /api/me", async () => {
    const cookie = await signUpAndVerify("amina@test.kemet", "Amina");
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle: "amina", displayName: "Amina", country: "SN" },
    });
    expect(patch.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().profile.handle).toBe("amina");
  });

  it("enregistre le rôle et la spécialité choisis à l'étape /ton-role", async () => {
    const cookie = await signUpAndVerify("fatou@test.kemet", "Fatou");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle: "fatou", displayName: "Fatou", country: "SN" },
    });

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { role: "developer", title: "Backend Go" },
    });
    expect(patch.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.json().profile.role).toBe("developer");
    expect(me.json().profile.title).toBe("Backend Go");
  });

  it("refuse un rôle hors de la liste autorisée", async () => {
    const cookie = await signUpAndVerify("awa@test.kemet", "Awa");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle: "awa", displayName: "Awa", country: "SN" },
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { role: "admin" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuse un identifiant déjà pris par un autre compte", async () => {
    const cookieA = await signUpAndVerify("a@test.kemet", "A");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieA },
      payload: { handle: "pris", displayName: "A", country: "SN" },
    });

    const cookieB = await signUpAndVerify("b@test.kemet", "B");
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieB },
      payload: { handle: "pris", displayName: "B", country: "CI" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("ne modifie jamais le profil d'un autre compte", async () => {
    const cookieA = await signUpAndVerify("owner@test.kemet", "Owner");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieA },
      payload: { handle: "owner", displayName: "Owner original", country: "SN" },
    });

    const cookieB = await signUpAndVerify("other@test.kemet", "Other");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieB },
      payload: { handle: "other", displayName: "Other modifie owner ?", country: "GH" },
    });

    const ownerProfile = await app.inject({ method: "GET", url: "/api/users/owner" });
    expect(ownerProfile.json().profile.displayName).toBe("Owner original");
  });

  it("permet de suivre un autre profil mais pas soi-même", async () => {
    const cookieA = await signUpAndVerify("follower@test.kemet", "Follower");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieA },
      payload: { handle: "follower", displayName: "Follower", country: "SN" },
    });
    const cookieB = await signUpAndVerify("followee@test.kemet", "Followee");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: cookieB },
      payload: { handle: "followee", displayName: "Followee", country: "GH" },
    });

    const follow = await app.inject({
      method: "POST",
      url: "/api/users/followee/follow",
      headers: { cookie: cookieA },
    });
    expect(follow.statusCode).toBe(200);

    const selfFollow = await app.inject({
      method: "POST",
      url: "/api/users/follower/follow",
      headers: { cookie: cookieA },
    });
    expect(selfFollow.statusCode).toBe(400);

    const followers = await app.inject({ method: "GET", url: "/api/users/followee/followers" });
    expect(followers.json().items).toHaveLength(1);
  });

  it("n'envoie jamais d'email de réinitialisation à une adresse de démonstration", async () => {
    const demoEmail = "skander.jaziri@demo.kemetlabs.dev";
    const realEmail = "vraie-personne@test.kemet";
    await deps.db.insert(user).values([
      { id: "demo-user", name: "Démo", email: demoEmail, emailVerified: true },
      { id: "real-user", name: "Réel", email: realEmail, emailVerified: true },
    ]);

    for (const email of [demoEmail, realEmail]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/request-password-reset",
        payload: { email, redirectTo: "http://localhost:5173/reinitialiser-mot-de-passe" },
      });
      expect(response.statusCode).toBe(200);
    }

    await vi.waitFor(() => expect(emailSender.findByRecipient(realEmail)).toHaveLength(1));
    expect(emailSender.findByRecipient(demoEmail)).toHaveLength(0);
  });

  it("refuse l'inscription sur le domaine de démonstration et ses sous-domaines, sans email envoyé", async () => {
    const demoEmails = ["nouveau@demo.kemetlabs.dev", "Nouveau@Equipe.Demo.Kemetlabs.dev"];
    const realEmail = "nouvelle-personne@test.kemet";
    const signUp = (email: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload: { email, password: "une-passphrase-solide", name: "Nouveau" },
      });

    for (const email of demoEmails) {
      const response = await signUp(email);
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe(DEMO_EMAIL_REJECTED_CODE);
    }
    expect((await signUp(realEmail)).statusCode).toBe(200);

    await vi.waitFor(() => expect(emailSender.findByRecipient(realEmail)).toHaveLength(1));
    const created = await deps.db
      .select({ email: user.email })
      .from(user)
      .where(ilike(user.email, "%demo.kemetlabs.dev"));
    expect(created).toEqual([]);
    for (const email of demoEmails) expect(emailSender.findByRecipient(email)).toHaveLength(0);
  });
});

describe.skipIf(!databaseUrl)("limite de tentatives sur la connexion", () => {
  it("bloque après plusieurs échecs de connexion rapprochés", async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
    const auth = createAuth({
      db,
      emailSender: new InMemoryEmailSender(),
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
    });
    const app = buildApp({ db, auth });

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email: "inconnu@test.kemet", password: "mot-de-passe-incorrect" },
      });

    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await attempt());

    expect(results.some((response) => response.statusCode === 429)).toBe(true);
  });

  it("envoie le lien de réinitialisation, puis bloque les demandes rapprochées", async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
    const emailSender = new InMemoryEmailSender();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
    });
    const app = buildApp({ db, auth });
    const email = "oubli@test.kemet";
    await db.insert(user).values({ id: "forgetful-user", name: "Oubli", email, emailVerified: true });

    const request = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/request-password-reset",
        payload: { email, redirectTo: "http://localhost:5173/reinitialiser-mot-de-passe" },
      });

    expect((await request()).statusCode).toBe(200);
    await vi.waitFor(() => expect(emailSender.findByRecipient(email)).toHaveLength(1));

    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await request());
    expect(results.some((response) => response.statusCode === 429)).toBe(true);
  });

  it("bloque les changements de mot de passe rapprochés", async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
    const auth = createAuth({
      db,
      emailSender: new InMemoryEmailSender(),
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
    });
    const app = buildApp({ db, auth });

    const attempt = () =>
      app.inject({
        method: "POST",
        url: "/api/auth/change-password",
        payload: { currentPassword: "une-mauvaise-phrase", newPassword: "une-nouvelle-phrase" },
      });

    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await attempt());
    expect(results.some((response) => response.statusCode === 429)).toBe(true);
  });
});
