import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  createDb,
  organizationManagers,
  organizationRequests,
  pointsLedger,
  posts,
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

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const JOB_OFFER = {
  slug: "dev-mobile-lagune",
  kind: "job",
  title: "Développeuse ou développeur mobile",
  organization: "Nom saisi à la main",
  remote: false,
  countryCode: "CI",
  city: "Abidjan",
  domains: ["mobile"],
  description: "Notre application de facturation passe sur téléphone.",
  contractType: "cdi",
  startDate: isoDateInDays(30),
  compensationFcfa: 600000,
  budgetMinFcfa: null,
  budgetMaxFcfa: null,
  deadline: null,
  criteria: [],
};

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

  async function createOrganization(managerHandle: string, adminHandle: string) {
    const manager = await createMember(managerHandle);
    const admin = await createMember(adminHandle, true);
    const sent = await sendRequest(manager.cookie, BASE_FIELDS);
    const accepted = await decide(admin.cookie, sent.json().request.id, "accept");
    const page = await app.inject({
      method: "GET",
      url: `/api/users/${accepted.json().organizationHandle}`,
    });
    return { manager, admin, organizationId: page.json().profile.id as string };
  }

  function suspend(profileId: string) {
    return db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, profileId));
  }

  it("refuse une demande et une décision venues d'un compte suspendu", async () => {
    const requester = await createMember("suspendu-k");
    const admin = await createMember("admin4-k", true);
    const sent = await sendRequest(requester.cookie, BASE_FIELDS);
    await suspend(admin.profileId);
    expect((await decide(admin.cookie, sent.json().request.id, "accept")).statusCode).toBe(403);

    await suspend(requester.profileId);
    const again = await sendRequest(requester.cookie, { ...BASE_FIELDS, name: "Autre" });
    expect(again.statusCode).toBe(403);
  });

  it("refuse d'accepter sa propre demande ou celle d'un compte suspendu depuis", async () => {
    const admin = await createMember("admin5-k", true);
    const own = await sendRequest(admin.cookie, BASE_FIELDS);
    expect((await decide(admin.cookie, own.json().request.id, "accept")).statusCode).toBe(409);

    const requester = await createMember("plus-tard-k");
    const other = await sendRequest(requester.cookie, { ...BASE_FIELDS, name: "Autre Studio" });
    await suspend(requester.profileId);
    expect((await decide(admin.cookie, other.json().request.id, "accept")).statusCode).toBe(409);
    expect(await db.select().from(organizationManagers)).toEqual([]);
  });

  it("montre le logo en attente au demandeur et à l'administration, à personne d'autre", async () => {
    const requester = await createMember("logo-k");
    const other = await createMember("curieux-k");
    const admin = await createMember("admin6-k", true);
    const sent = await sendRequest(requester.cookie, BASE_FIELDS, {
      data: PNG_BYTES,
      type: "image/png",
    });
    const logoUrl = sent.json().request.logoUrl as string;
    const read = (cookie: string) =>
      app.inject({ method: "GET", url: logoUrl, headers: { cookie } });
    expect((await read(other.cookie)).statusCode).toBe(404);
    expect((await read(admin.cookie)).statusCode).toBe(200);

    // Une organisation suspendue ne montre plus son logo au public.
    await decide(admin.cookie, sent.json().request.id, "accept");
    expect((await app.inject({ method: "GET", url: logoUrl })).statusCode).toBe(200);
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.handle, "lagune-studio"));
    expect((await app.inject({ method: "GET", url: logoUrl })).statusCode).toBe(404);
  });

  it("refuse un logo trop lourd, une image trop grande et un site en http", async () => {
    const requester = await createMember("lourd-k");
    const heavy = Buffer.concat([PNG_BYTES, Buffer.alloc(1024 * 1024)]);
    const heavySent = await sendRequest(requester.cookie, BASE_FIELDS, {
      data: heavy,
      type: "image/png",
    });
    expect(heavySent.statusCode).toBe(400);
    expect(heavySent.body).toContain("1 Mo");
    const wide = Buffer.from(PNG_BYTES);
    wide.writeUInt32BE(5000, 16);
    const wideSent = await sendRequest(requester.cookie, BASE_FIELDS, {
      data: wide,
      type: "image/png",
    });
    expect(wideSent.statusCode).toBe(400);
    const http = await sendRequest(requester.cookie, {
      ...BASE_FIELDS,
      websiteUrl: "http://lagune.example",
    });
    expect(http.statusCode).toBe(400);
    expect(await db.select().from(organizationRequests)).toEqual([]);
  });

  it("limite les demandes à cinq par heure et par compte", async () => {
    const requester = await createMember("presse-k");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await sendRequest(requester.cookie, BASE_FIELDS)).statusCode);
    }
    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });

  it("ne montre sur la page d'un auteur que les posts d'espace visibles par qui la lit", async () => {
    const author = await createMember("auteur-k");
    const reader = await createMember("lecteur-k");
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: author.cookie },
      payload: { name: "Espace privé", slug: "espace-prive-k", visibility: "private" },
    });
    const spaceId = space.json().space.id as string;
    await db.insert(posts).values([
      { authorId: author.profileId, body: "Post public" },
      { authorId: author.profileId, body: "Post réservé à l'espace", spaceId },
    ]);
    async function bodies(cookie: string | null): Promise<string[]> {
      const response = await app.inject({
        method: "GET",
        url: "/api/users/auteur-k/posts",
        headers: cookie ? { cookie } : {},
      });
      return response.json().items.map((post: { body: string }) => post.body);
    }
    expect(await bodies(reader.cookie)).toEqual(["Post public"]);
    expect(await bodies(null)).toEqual(["Post public"]);
    expect((await bodies(author.cookie)).sort()).toEqual([
      "Post public",
      "Post réservé à l'espace",
    ]);
    const badCursor = await app.inject({
      method: "GET",
      url: "/api/users/auteur-k/posts?cursor=pas-une-date",
    });
    expect(badCursor.statusCode).toBe(400);
  });

  describe("publier au nom d'une organisation", () => {
    it("publie un post au nom de l'organisation pour son gestionnaire, refuse les autres", async () => {
      const { manager, organizationId } = await createOrganization("gerant-k", "admin7-k");
      const outsider = await createMember("intrus-k");

      const refused = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: outsider.cookie },
        payload: { body: "Je parle pour Lagune", asOrganizationId: organizationId },
      });
      expect(refused.statusCode).toBe(403);

      const created = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: manager.cookie },
        payload: { body: "Nous recrutons", asOrganizationId: organizationId },
      });
      expect(created.statusCode).toBe(200);
      const post = created.json().post;
      expect(post).toMatchObject({
        authorHandle: "lagune-studio",
        authorKind: "organization",
        authorLevel: null,
      });
      const [stored] = await db.select().from(posts).where(eq(posts.id, post.id));
      expect(stored!.publishedById).toBe(manager.profileId);

      const outsiderDelete = await app.inject({
        method: "DELETE",
        url: `/api/posts/${post.id}`,
        headers: { cookie: outsider.cookie },
      });
      expect(outsiderDelete.statusCode).toBe(403);
      const managerDelete = await app.inject({
        method: "DELETE",
        url: `/api/posts/${post.id}`,
        headers: { cookie: manager.cookie },
      });
      expect(managerDelete.statusCode).toBeLessThan(300);
    });

    it("publie une offre au nom de l'organisation, avec le gestionnaire comme contact", async () => {
      const { manager, organizationId } = await createOrganization("gerante-k", "admin8-k");
      const outsider = await createMember("autre-k");

      const refused = await app.inject({
        method: "POST",
        url: "/api/opportunities",
        headers: { cookie: outsider.cookie },
        payload: { ...JOB_OFFER, asOrganizationId: organizationId },
      });
      expect(refused.statusCode).toBe(403);

      const created = await app.inject({
        method: "POST",
        url: "/api/opportunities",
        headers: { cookie: manager.cookie },
        payload: { ...JOB_OFFER, asOrganizationId: organizationId },
      });
      expect(created.statusCode).toBe(200);
      expect(created.json().opportunity).toMatchObject({
        authorHandle: "lagune-studio",
        organization: "Lagune Studio",
        contactHandle: "gerante-k",
        authorLevel: null,
      });

      const edit = (cookie: string, title: string) =>
        app.inject({
          method: "PUT",
          url: `/api/opportunities/${JOB_OFFER.slug}`,
          headers: { cookie },
          payload: { ...JOB_OFFER, slug: undefined, title, organization: "Un autre nom" },
        });
      expect((await edit(outsider.cookie, "Titre changé par un intrus")).statusCode).toBe(403);
      const managerEdit = await edit(manager.cookie, "Développeuse ou développeur Flutter");
      expect(managerEdit.statusCode).toBe(200);
      // L'offre d'une organisation garde son nom référencé, même modifiée.
      expect(managerEdit.json().opportunity.organization).toBe("Lagune Studio");
    });

    it("refuse un retour structuré du gestionnaire sur un post de son organisation", async () => {
      const { manager, organizationId } = await createOrganization("testeur-k", "admin9-k");
      const created = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: manager.cookie },
        payload: {
          body: "Essayez notre nouvelle page de facturation",
          format: "a_tester",
          testUrl: "https://lagune.example/essai",
          testAsk: "Le formulaire est-il clair ?",
          asOrganizationId: organizationId,
        },
      });
      expect(created.statusCode).toBe(200);
      const feedback = await app.inject({
        method: "POST",
        url: `/api/posts/${created.json().post.id}/feedback`,
        headers: { cookie: manager.cookie },
        payload: { body: "Très clair, bravo à nous." },
      });
      expect(feedback.statusCode).toBe(400);
      expect(
        await db.select().from(pointsLedger).where(eq(pointsLedger.profileId, manager.profileId)),
      ).toEqual([]);
    });

    it("refuse de modifier un post ou de supprimer une offre de l'organisation à qui ne la gère pas", async () => {
      const { manager, organizationId } = await createOrganization("gerant2-k", "admin10-k");
      const outsider = await createMember("intrus2-k");
      const post = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: manager.cookie },
        payload: { body: "Premier post", asOrganizationId: organizationId },
      });
      const postId = post.json().post.id as string;
      const editPost = (cookie: string) =>
        app.inject({
          method: "PATCH",
          url: `/api/posts/${postId}`,
          headers: { cookie },
          payload: { body: "Post modifié" },
        });
      expect((await editPost(outsider.cookie)).statusCode).toBe(403);
      expect((await editPost(manager.cookie)).statusCode).toBe(200);

      await app.inject({
        method: "POST",
        url: "/api/opportunities",
        headers: { cookie: manager.cookie },
        payload: { ...JOB_OFFER, asOrganizationId: organizationId },
      });
      const deleteOffer = (cookie: string) =>
        app.inject({
          method: "DELETE",
          url: `/api/opportunities/${JOB_OFFER.slug}`,
          headers: { cookie },
        });
      expect((await deleteOffer(outsider.cookie)).statusCode).toBe(403);
      expect((await deleteOffer(manager.cookie)).statusCode).toBeLessThan(300);
    });

    it("refuse de publier au nom d'une personne ou d'une organisation suspendue", async () => {
      const { manager, organizationId } = await createOrganization("gerant3-k", "admin11-k");
      const person = await createMember("personne-k");
      const publish = (asOrganizationId: string) =>
        app.inject({
          method: "POST",
          url: "/api/posts",
          headers: { cookie: manager.cookie },
          payload: { body: "Au nom de quelqu'un d'autre", asOrganizationId },
        });
      expect((await publish(person.profileId)).statusCode).toBe(403);
      await suspend(organizationId);
      expect((await publish(organizationId)).statusCode).toBe(403);
    });

    it("exporte les demandes et les organisations gérées, sans l'administrateur qui a décidé", async () => {
      const { manager } = await createOrganization("exporte-k", "admin12-k");
      const exported = await app.inject({
        method: "GET",
        url: "/api/me/export",
        headers: { cookie: manager.cookie },
      });
      expect(exported.statusCode).toBe(200);
      const data = exported.json();
      expect(data.managedOrganizations.map((row: { handle: string }) => row.handle)).toEqual([
        "lagune-studio",
      ]);
      expect(data.organizationRequests).toHaveLength(1);
      expect(data.organizationRequests[0]).not.toHaveProperty("decidedById");
      expect(data.organizationRequests[0]).not.toHaveProperty("logoStorageKey");
    });
  });

  it("compte comme doublon un nom qui ne diffère que par ses espaces", async () => {
    const first = await createMember("espace1-k");
    const second = await createMember("espace2-k");
    await sendRequest(first.cookie, BASE_FIELDS);
    const spaced = await sendRequest(second.cookie, { ...BASE_FIELDS, name: "  Lagune   Studio " });
    expect(spaced.statusCode).toBe(409);
  });

  it("refuse un identifiant mal formé sur la liste des posts d'un auteur", async () => {
    const response = await app.inject({ method: "GET", url: "/api/users/%20%3Cscript%3E/posts" });
    expect(response.statusCode).toBe(400);
  });
});
