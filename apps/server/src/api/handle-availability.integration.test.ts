import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Disponibilité d'un identifiant (base Postgres réelle)", () => {
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
    app = buildApp({ db, auth, chat: createNoopChatPublisher() });
  });

  async function signIn(name: string): Promise<string> {
    const email = `${name}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const raw = response.headers["set-cookie"];
    return String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
  }

  function check(cookie: string | undefined, handle: string) {
    return app.inject({
      method: "GET",
      url: `/api/me/handle-availability?handle=${encodeURIComponent(handle)}`,
      headers: cookie ? { cookie } : {},
    });
  }

  it("refuse un visiteur", async () => {
    expect((await check(undefined, "libre")).statusCode).toBe(401);
  });

  it("dit libre, pris, réservé ou invalide, sans nommer le propriétaire", async () => {
    const owner = await signIn("awa");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: owner },
      payload: { handle: "awa-ndiaye", displayName: "Awa Ndiaye" },
    });
    const cookie = await signIn("moussa");

    expect((await check(cookie, "moussa-sall")).json()).toEqual({ available: true });

    const taken = await check(cookie, "awa-ndiaye");
    expect(taken.statusCode).toBe(200);
    expect(taken.json()).toEqual({ available: false, reason: "taken" });
    expect(taken.body).not.toContain("Awa");

    expect((await check(cookie, "kocc")).json()).toEqual({ available: false, reason: "reserved" });
    expect((await check(cookie, "Majuscules")).json()).toEqual({
      available: false,
      reason: "invalid",
    });
    expect((await check(cookie, "ab")).json()).toEqual({ available: false, reason: "invalid" });
  });

  it("dit libre son propre identifiant", async () => {
    const cookie = await signIn("fatou");
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle: "fatou-diop", displayName: "Fatou Diop" },
    });
    expect((await check(cookie, "fatou-diop")).json()).toEqual({ available: true });
  });

  it("dit pris l'identifiant d'un profil invisible", async () => {
    const cookie = await signIn("ibou");
    await db.insert(profiles).values({
      handle: "figurant-test",
      displayName: "Figurant",
      country: "SN",
      isFiller: true,
    });
    expect((await check(cookie, "figurant-test")).json()).toEqual({
      available: false,
      reason: "taken",
    });
  });

  it("refuse une requête sans identifiant ou trop longue", async () => {
    const cookie = await signIn("khady");
    expect((await check(cookie, "x".repeat(61))).statusCode).toBe(400);
    const missing = await app.inject({
      method: "GET",
      url: "/api/me/handle-availability",
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(400);
  });
});
