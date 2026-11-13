import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { account, createDb, user } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../api/app.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createAuth } from "./auth.js";

const databaseUrl = getTestDatabaseUrl();
const WEB_APP_URL = "http://localhost:5173";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function unsignedIdToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
}

function cookiesOf(header: string | string[] | undefined): string {
  return (Array.isArray(header) ? header : header ? [header] : [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

// Seul l'échange du code contre les jetons part chez Google : il est simulé,
// tout le reste (état, rattachement, session) est le vrai code de Better Auth.
describe.skipIf(!databaseUrl)("connexion Google sur un compte existant de même email", () => {
  let app: ReturnType<typeof buildApp>;
  let db: ReturnType<typeof createDb>;
  let emailSender: InMemoryEmailSender;
  const realFetch = globalThis.fetch;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: WEB_APP_URL,
      secret: "test-secret-at-least-32-characters-long",
      google: { clientId: "client-test", clientSecret: "secret-test" },
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function signUpWithPassword(email: string, password: string, verify: boolean) {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password, name: "Awa" },
    });
    if (!verify) return;
    const link = emailSender.findByRecipient(email)[0]?.html.match(/href="([^"]+)"/)?.[1];
    if (!link) throw new Error("Email de vérification introuvable.");
    const verification = new URL(link);
    await app.inject({ method: "GET", url: verification.pathname + verification.search });
  }

  async function signInWithGoogle(claims: Record<string, unknown>) {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === GOOGLE_TOKEN_ENDPOINT) {
        return Response.json({
          access_token: "access-test",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: unsignedIdToken({
            iss: "https://accounts.google.com",
            aud: "client-test",
            ...claims,
          }),
        });
      }
      return realFetch(input, init);
    });

    const start = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      headers: { origin: WEB_APP_URL },
      payload: { provider: "google", callbackURL: `${WEB_APP_URL}/fil` },
    });
    expect(start.statusCode).toBe(200);
    const state = new URL(start.json<{ url: string }>().url).searchParams.get("state");
    const callback = await app.inject({
      method: "GET",
      url: `/api/auth/callback/google?code=code-test&state=${state}`,
      headers: { cookie: cookiesOf(start.headers["set-cookie"]) },
    });
    return {
      location: String(callback.headers.location ?? ""),
      setCookie: callback.headers["set-cookie"],
    };
  }

  async function providersOf(email: string) {
    const rows = await db
      .select({ providerId: account.providerId })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(eq(user.email, email));
    return rows.map((row) => row.providerId).sort();
  }

  it("rattache Google au compte vérifié, et le mot de passe reste valable", async () => {
    const email = "awa@example.com";
    const password = "une-passphrase-solide";
    await signUpWithPassword(email, password, true);

    const { location, setCookie } = await signInWithGoogle({
      sub: "google-awa",
      email,
      email_verified: true,
      name: "Awa Google",
    });
    expect(location).toBe(`${WEB_APP_URL}/fil`);
    expect(cookiesOf(setCookie)).toContain("better-auth.session_token=");
    expect(await providersOf(email)).toEqual(["credential", "google"]);
    const [row] = await db.select({ name: user.name }).from(user).where(eq(user.email, email));
    expect(row!.name).toBe("Awa");

    const passwordSignIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password },
    });
    expect(passwordSignIn.statusCode).toBe(200);
  });

  it("refuse le rattachement quand Google ne confirme pas l'adresse", async () => {
    const email = "binta@example.com";
    await signUpWithPassword(email, "une-passphrase-solide", true);
    const { location } = await signInWithGoogle({
      sub: "google-binta",
      email,
      email_verified: false,
    });
    expect(location).toContain("error=account_not_linked");
    expect(await providersOf(email)).toEqual(["credential"]);
  });

  // Sinon, quiconque crée un compte à mot de passe avec l'adresse d'une autre
  // personne, sans pouvoir la vérifier, récupérerait sa connexion Google.
  it("refuse le rattachement à un compte dont l'adresse n'a jamais été vérifiée", async () => {
    const email = "coura@example.com";
    await signUpWithPassword(email, "une-passphrase-solide", false);
    const { location } = await signInWithGoogle({
      sub: "google-coura",
      email,
      email_verified: true,
    });
    expect(location).toContain("error=account_not_linked");
    expect(await providersOf(email)).toEqual(["credential"]);
  });
});
