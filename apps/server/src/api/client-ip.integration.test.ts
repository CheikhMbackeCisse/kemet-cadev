import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PROXY_ADDRESS = "172.18.0.4";
const CLIENT_A = "203.0.113.10";
const CLIENT_B = "203.0.113.20";
const CLIENT_C = "203.0.113.30";
const CLIENT_D = "203.0.113.40";
const PUBLIC_ADDRESS = "198.51.100.7";
const OTHER_PUBLIC_ADDRESS = "198.51.100.8";

describe.skipIf(!databaseUrl)("Adresse du client derrière le proxy (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    const db = createDb(databaseUrl!);
    const auth = createAuth({
      db,
      emailSender: new InMemoryEmailSender(),
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: true,
    });
    // Facteur 1 : la limite d'une requête sans session reste celle de la route.
    app = buildApp({
      db,
      auth,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 1 },
    });
    app.after(() => {
      app.get("/test/ip", async (request) => ({ ip: request.ip }));
      app.get("/test/limited", { config: { rateLimit: { max: 2, timeWindow: 60_000 } } }, async () => ({ ok: true }));
    });
  });

  function fromProxy(client: string) {
    return { remoteAddress: PROXY_ADDRESS, headers: { "x-forwarded-for": client } };
  }

  it("lit l'adresse transmise par le proxy", async () => {
    const response = await app.inject({ method: "GET", url: "/test/ip", ...fromProxy(CLIENT_A) });
    expect(response.json()).toEqual({ ip: CLIENT_A });
  });

  it("ignore un X-Forwarded-For envoyé depuis une adresse publique", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/test/ip",
      remoteAddress: PUBLIC_ADDRESS,
      headers: { "x-forwarded-for": CLIENT_A },
    });
    expect(response.json()).toEqual({ ip: PUBLIC_ADDRESS });
  });

  it("compte la limite de débit d'une route séparément pour chaque client", async () => {
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await app.inject({ method: "GET", url: "/test/limited", ...fromProxy(CLIENT_A) })).statusCode);
    }
    expect(statuses).toEqual([200, 200, 429]);

    const otherClient = await app.inject({ method: "GET", url: "/test/limited", ...fromProxy(CLIENT_B) });
    expect(otherClient.statusCode).toBe(200);
  });

  async function signIn(options: { remoteAddress: string; headers: Record<string, string> }) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: "inconnu@test.kemet", password: "une-passphrase-solide" },
      ...options,
    });
    return response.statusCode;
  }

  // Le compteur en mémoire de Better Auth est partagé par toutes ses
  // instances du processus : chaque test de connexion prend ses propres adresses.
  it("compte la limite de connexion de Better Auth séparément pour chaque client", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) statuses.push(await signIn(fromProxy(CLIENT_C)));
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);

    expect(await signIn(fromProxy(CLIENT_D))).not.toBe(429);
  });

  it("ne laisse pas un client contourner la limite de connexion en changeant d'en-tête", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push(
        await signIn({
          remoteAddress: OTHER_PUBLIC_ADDRESS,
          headers: { "x-forwarded-for": `203.0.113.${100 + i}`, "x-kemet-client-ip": `203.0.113.${200 + i}` },
        }),
      );
    }
    expect(statuses[5]).toBe(429);
  });
});
