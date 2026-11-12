import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  createDb,
  organizationManagers,
  organizationRequests,
  pointsLedger,
  profiles,
  type Db,
} from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { awardPoints } from "./repositories/points.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();
const PASSWORD = "une-passphrase-solide";
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);
const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);
const BOUNDARY = "----kemetorgboundary";

interface RequestFields {
  name?: string;
  organizationType?: string;
  country?: string;
  websiteUrl?: string;
  description?: string;
}

function multipart(fields: RequestFields, logo?: { data: Buffer; type: string }): Buffer {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  if (logo) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="logo"; filename="logo"\r\nContent-Type: ${logo.type}\r\n\r\n`,
      ),
      logo.data,
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
}

const BASE_FIELDS: RequestFields = {
  name: "Lagune Studio",
  organizationType: "company",
  country: "CI",
  websiteUrl: "https://lagune.example",
  description: "Logiciels pour les PME.",
};

describe.skipIf(!databaseUrl)("Organisations (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let storage: InMemoryStorage;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    storage = new InMemoryStorage();
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({
      db,
      auth,
      storage,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 3 },
    });
  }, 30_000);

  afterEach(async () => {
    await db.$client.end();
  });

  async function createMember(handle: string, admin = false) {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: PASSWORD, name: handle },
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
    const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    const profileId = me.json().profile.id as string;
    if (admin)
      await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, profileId));
    return { cookie, profileId };
  }

  function sendRequest(
    cookie: string | null,
    fields: RequestFields,
    logo?: { data: Buffer; type: string },
  ) {
    return app.inject({
      method: "POST",
      url: "/api/organization-requests",
      headers: {
        ...(cookie ? { cookie } : {}),
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart(fields, logo),
    });
  }

  function decide(cookie: string, id: string, decision: "accept" | "refuse") {
    return app.inject({
      method: "PUT",
      url: `/api/organization-requests/${id}`,
      headers: { cookie },
      payload: { decision },
    });
  }

  it("enregistre une demande en attente, puis l'acceptation crée la page et donne la gestion", async () => {
    const requester = await createMember("ahou-k");
    const admin = await createMember("admin-k", true);

    const sent = await sendRequest(requester.cookie, BASE_FIELDS, {
      data: PNG_BYTES,
      type: "image/png",
    });
    expect(sent.statusCode).toBe(200);
    const request = sent.json().request;
    expect(request).toMatchObject({
      status: "pending",
      name: "Lagune Studio",
      requesterHandle: "ahou-k",
    });

    const mine = await app.inject({
      method: "GET",
      url: "/api/me/organization-request",
      headers: { cookie: requester.cookie },
    });
    expect(mine.json().request.status).toBe("pending");

    // Logo d'une demande en attente : à la personne qui l'a envoyé et aux administrateurs seulement.
    expect((await app.inject({ method: "GET", url: request.logoUrl })).statusCode).toBe(404);
    const ownLogo = await app.inject({
      method: "GET",
      url: request.logoUrl,
      headers: { cookie: requester.cookie },
    });
    expect(ownLogo.statusCode).toBe(200);
    expect(ownLogo.headers["x-content-type-options"]).toBe("nosniff");

    const accepted = await decide(admin.cookie, request.id, "accept");
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual({ status: "accepted", organizationHandle: "lagune-studio" });

    const page = await app.inject({ method: "GET", url: "/api/users/lagune-studio" });
    expect(page.statusCode).toBe(200);
    expect(page.json().profile).toMatchObject({
      kind: "organization",
      organizationType: "company",
      level: null,
      bio: "Logiciels pour les PME.",
      websiteUrl: "https://lagune.example",
    });
    expect(page.json().acceptsMessages).toBe(false);
    expect((await app.inject({ method: "GET", url: request.logoUrl })).statusCode).toBe(200);

    const managed = await app.inject({
      method: "GET",
      url: "/api/me/organizations",
      headers: { cookie: requester.cookie },
    });
    expect(managed.json().items.map((item: { handle: string }) => item.handle)).toEqual([
      "lagune-studio",
    ]);

    // Une organisation ne reçoit jamais de points.
    const organizationId = page.json().profile.id as string;
    await awardPoints(db, {
      profileId: organizationId,
      source: "post_reply_solution",
      sourceId: organizationId,
      amount: 15,
    });
    expect(
      await db.select().from(pointsLedger).where(eq(pointsLedger.profileId, organizationId)),
    ).toEqual([]);
  });

  it("refuse les décisions à qui n'est pas administrateur, et une demande sans session", async () => {
    const requester = await createMember("awa-k");
    const other = await createMember("other-k");
    expect((await sendRequest(null, BASE_FIELDS)).statusCode).toBe(401);
    const sent = await sendRequest(requester.cookie, BASE_FIELDS);
    const id = sent.json().request.id as string;

    expect((await decide(requester.cookie, id, "accept")).statusCode).toBe(403);
    expect((await decide(other.cookie, id, "accept")).statusCode).toBe(403);
    const list = await app.inject({
      method: "GET",
      url: "/api/organization-requests",
      headers: { cookie: other.cookie },
    });
    expect(list.statusCode).toBe(403);
    expect(await db.select().from(organizationManagers)).toEqual([]);
  });

  it("garde une demande refusée privée et efface son logo", async () => {
    const requester = await createMember("ibou-k");
    const admin = await createMember("admin2-k", true);
    const sent = await sendRequest(requester.cookie, BASE_FIELDS, {
      data: PNG_BYTES,
      type: "image/png",
    });
    const request = sent.json().request;
    const [stored] = await db
      .select()
      .from(organizationRequests)
      .where(eq(organizationRequests.id, request.id));

    expect((await decide(admin.cookie, request.id, "refuse")).statusCode).toBe(200);
    expect(() => storage.read(stored!.logoStorageKey!)).toThrow();
    expect(
      (
        await app.inject({
          method: "GET",
          url: request.logoUrl,
          headers: { cookie: requester.cookie },
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/users/lagune-studio" })).statusCode).toBe(
      404,
    );
    expect((await decide(admin.cookie, request.id, "accept")).statusCode).toBe(409);

    // Après un refus, une nouvelle demande est possible.
    expect((await sendRequest(requester.cookie, BASE_FIELDS)).statusCode).toBe(200);
  });

  it("refuse une seconde demande en attente et un nom déjà pris, sans tenir compte de la casse", async () => {
    const first = await createMember("first-k");
    const second = await createMember("second-k");
    const admin = await createMember("admin3-k", true);
    const sent = await sendRequest(first.cookie, BASE_FIELDS);
    expect(
      (await sendRequest(first.cookie, { ...BASE_FIELDS, name: "Autre Nom" })).statusCode,
    ).toBe(409);
    expect(
      (await sendRequest(second.cookie, { ...BASE_FIELDS, name: "lagune STUDIO" })).statusCode,
    ).toBe(409);

    await decide(admin.cookie, sent.json().request.id, "accept");
    expect(
      (await sendRequest(second.cookie, { ...BASE_FIELDS, name: "LAGUNE studio" })).statusCode,
    ).toBe(409);
  });

  it("refuse un logo SVG, un champ inconnu et un site qui n'est pas un lien http", async () => {
    const requester = await createMember("seydou-k");
    expect(
      (await sendRequest(requester.cookie, BASE_FIELDS, { data: SVG_BYTES, type: "image/svg+xml" }))
        .statusCode,
    ).toBe(400);
    expect(
      (await sendRequest(requester.cookie, { ...BASE_FIELDS, websiteUrl: "javascript:alert(1)" }))
        .statusCode,
    ).toBe(400);
    const extra = await app.inject({
      method: "POST",
      url: "/api/organization-requests",
      headers: {
        cookie: requester.cookie,
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart({ ...BASE_FIELDS, isPlatformAdmin: "true" } as RequestFields),
    });
    // Un sixième champ dépasse la limite du formulaire : refusé avant toute lecture.
    expect(extra.statusCode).toBe(413);
    expect(await db.select().from(organizationRequests)).toEqual([]);
  });
});
