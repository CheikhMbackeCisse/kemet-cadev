import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { KEMET_ASSISTANT_PROFILE_ID } from "../chat/kemet-assistant.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();
const PASSWORD = "une-passphrase-solide";

describe.skipIf(!databaseUrl)("Profil de Kocc (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let db: Db;

  afterEach(async () => {
    await db.$client.end();
  });

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

  async function signUp(email: string): Promise<string> {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: PASSWORD, name: "Test" },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: PASSWORD },
    });
    const raw = signIn.headers["set-cookie"];
    return String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
  }

  it("refuse les identifiants kocc et kemet à une personne", async () => {
    const cookie = await signUp("prise@test.kemet");
    for (const handle of ["kocc", "kemet"]) {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/me/profile",
        headers: { cookie },
        payload: { handle, displayName: "Usurpation", country: "SN" },
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("montre l'assistant sous le nom de Kocc, sans bio, à /u/kocc comme à /u/kemet", async () => {
    const [stored] = await db.select().from(profiles).where(eq(profiles.id, KEMET_ASSISTANT_PROFILE_ID));
    expect(stored?.handle).toBe("kemet");

    for (const handle of ["kocc", "kemet"]) {
      const response = await app.inject({ method: "GET", url: `/api/users/${handle}` });
      expect(response.statusCode).toBe(200);
      expect(response.json().profile).toMatchObject({
        id: KEMET_ASSISTANT_PROFILE_ID,
        handle: "kocc",
        displayName: "Kocc",
        bio: null,
        title: null,
      });
    }
  });
});
