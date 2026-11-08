import Fastify, { type FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { normalizeClientAddress, rateLimitKey, registerRateLimit } from "./rate-limit.js";

const SHARED_ADDRESS = "203.0.113.10";

function buildTestApp(routeMax: number | ((request: FastifyRequest) => number), anonymousFactor = 3) {
  const app = Fastify();
  registerRateLimit(app, {
    resolveUserId: async (request) => {
      const user = request.headers["x-test-user"];
      return typeof user === "string" ? user : null;
    },
    anonymousFactor,
  });
  app.after(() => {
    app.get("/limited", { config: { rateLimit: { max: routeMax, timeWindow: 60_000 } } }, async () => ({ ok: true }));
    app.get("/other", { config: { rateLimit: { max: routeMax, timeWindow: 60_000 } } }, async () => ({ ok: true }));
    app.get("/free", async () => ({ ok: true }));
  });
  return app;
}

async function statuses(app: ReturnType<typeof Fastify>, count: number, user?: string, url = "/limited") {
  const result: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const response = await app.inject({
      method: "GET",
      url,
      remoteAddress: SHARED_ADDRESS,
      headers: user ? { "x-test-user": user } : {},
    });
    result.push(response.statusCode);
  }
  return result;
}

describe("registerRateLimit", () => {
  it("compte la limite par compte connecté, même derrière une adresse partagée", async () => {
    const app = buildTestApp(2);
    expect(await statuses(app, 3, "user-a")).toEqual([200, 200, 429]);
    expect(await statuses(app, 2, "user-b")).toEqual([200, 200]);
  });

  it("donne une limite plus large à une adresse sans session", async () => {
    const app = buildTestApp(2, 3);
    expect(await statuses(app, 7)).toEqual([200, 200, 200, 200, 200, 200, 429]);
  });

  it("ne partage pas le compteur d'une adresse avec un compte connecté depuis celle-ci", async () => {
    const app = buildTestApp(2);
    await statuses(app, 6);
    expect(await statuses(app, 1)).toEqual([429]);
    expect(await statuses(app, 1, "user-a")).toEqual([200]);
  });

  it("garde un compteur par route", async () => {
    const app = buildTestApp(1);
    expect(await statuses(app, 2, "user-a")).toEqual([200, 429]);
    expect(await statuses(app, 1, "user-a", "/other")).toEqual([200]);
  });

  it("élargit aussi une limite calculée par une fonction", async () => {
    const app = buildTestApp(() => 1, 2);
    expect(await statuses(app, 3)).toEqual([200, 200, 429]);
    expect(await statuses(app, 2, "user-a")).toEqual([200, 429]);
  });

  it("n'élargit qu'une fois un objet de configuration partagé par plusieurs routes", async () => {
    const app = Fastify();
    registerRateLimit(app, { resolveUserId: async () => null, anonymousFactor: 3 });
    const shared = { config: { rateLimit: { max: 2, timeWindow: 60_000 } } };
    app.after(() => {
      app.get("/a", shared, async () => ({ ok: true }));
      app.get("/b", shared, async () => ({ ok: true }));
    });
    for (const [method, url] of [["GET", "/a"], ["HEAD", "/a"], ["GET", "/b"], ["HEAD", "/b"]] as const) {
      const response = await app.inject({ method, url, remoteAddress: SHARED_ADDRESS });
      expect(response.headers["x-ratelimit-limit"], `${method} ${url}`).toBe("6");
    }
  });

  it("refuse la requête si la session ne peut pas être lue, sans retomber sur l'adresse", async () => {
    const app = Fastify();
    registerRateLimit(app, {
      resolveUserId: async () => {
        throw new Error("base indisponible");
      },
      anonymousFactor: 3,
    });
    app.after(() => {
      app.get("/limited", { config: { rateLimit: { max: 2, timeWindow: 60_000 } } }, async () => ({ ok: true }));
    });
    const response = await app.inject({ method: "GET", url: "/limited", remoteAddress: SHARED_ADDRESS });
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
  });

  it("laisse sans limite une route qui n'en déclare pas", async () => {
    const app = buildTestApp(1);
    expect(await statuses(app, 5, undefined, "/free")).toEqual([200, 200, 200, 200, 200]);
  });
});

describe("rateLimitKey", () => {
  it("préfère le compte à l'adresse", () => {
    expect(rateLimitKey("abc", SHARED_ADDRESS)).toBe("user:abc");
    expect(rateLimitKey(null, SHARED_ADDRESS)).toBe(`ip:${SHARED_ADDRESS}`);
  });
});

describe("normalizeClientAddress", () => {
  it("garde une adresse IPv4 telle quelle", () => {
    expect(normalizeClientAddress("198.51.100.7")).toBe("198.51.100.7");
  });

  it("ramène une adresse IPv4 encapsulée en IPv6 à sa forme IPv4", () => {
    expect(normalizeClientAddress("::ffff:198.51.100.7")).toBe("198.51.100.7");
  });

  it("reconnaît une adresse IPv4 encapsulée écrite en forme longue", () => {
    expect(normalizeClientAddress("0:0:0:0:0:ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(normalizeClientAddress("::ffff:c633:6407")).toBe("198.51.100.7");
  });

  it("sépare les clients IPv4 passés par une passerelle NAT64", () => {
    expect(normalizeClientAddress("64:ff9b::198.51.100.7")).toBe("198.51.100.7");
    expect(normalizeClientAddress("64:ff9b::198.51.100.8")).toBe("198.51.100.8");
  });

  it("regroupe les adresses IPv6 d'un même préfixe /64", () => {
    const first = normalizeClientAddress("2001:db8:12:34:aaaa:bbbb:cccc:dddd");
    expect(first).toBe("2001:db8:12:34::/64");
    expect(normalizeClientAddress("2001:0db8:0012:0034::1")).toBe(first);
    expect(normalizeClientAddress("2001:db8:12:35::1")).not.toBe(first);
  });

  it("développe une adresse IPv6 abrégée en tête", () => {
    expect(normalizeClientAddress("::1")).toBe("0:0:0:0::/64");
  });
});
