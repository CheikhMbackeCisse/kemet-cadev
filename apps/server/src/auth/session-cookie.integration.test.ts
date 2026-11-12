import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../api/app.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createAuth } from "./auth.js";

const databaseUrl = getTestDatabaseUrl();

// La production sert l'API en https (BETTER_AUTH_URL, docs/DEPLOIEMENT.md) :
// c'est cette adresse qui décide de l'attribut Secure et du préfixe __Secure-.
describe.skipIf(!databaseUrl)("cookie de session en production", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "https://kemetlabs.dev",
      webAppUrl: "https://kemetlabs.dev",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth });
  });

  it("est Secure, HttpOnly et SameSite=Lax", async () => {
    const email = "cookie@example.com";
    const password = "une-passphrase-solide";
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password, name: "Awa" },
    });
    const link = emailSender.findByRecipient(email)[0]?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) throw new Error("Email de vérification introuvable.");
    const verification = new URL(link);
    await app.inject({ method: "GET", url: verification.pathname + verification.search });

    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password },
    });
    expect(signIn.statusCode).toBe(200);

    const raw = signIn.headers["set-cookie"];
    const cookies = (Array.isArray(raw) ? raw : [raw]).map(String);
    const session = cookies.find((cookie) =>
      cookie.startsWith("__Secure-better-auth.session_token="),
    );
    expect(session).toBeDefined();
    for (const cookie of cookies) {
      const attributes = cookie.split(";").map((part) => part.trim().toLowerCase());
      expect(attributes).toContain("secure");
      expect(attributes).toContain("httponly");
      expect(attributes).toContain("samesite=lax");
    }
  });
});
