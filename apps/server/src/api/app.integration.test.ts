import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("API intégration (base Postgres réelle)", () => {
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
      // Désactivé ici : ces tests créent plusieurs comptes en rafale, ce que
      // la limite par défaut de Better Auth sur /sign-up (3 par 10s) refuse.
      // La limite elle-même est vérifiée séparément plus bas.
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
});
