import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, spaces, WORK_DISCUSSIONS_SPACE_ID, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Recherche d'espaces et de personnes (base Postgres réelle)", () => {
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

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createProfile(handle: string, displayName = handle) {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: displayName },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const cookie = extractCookie(signIn);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName },
    });
    expect(response.statusCode).toBe(200);
    return { cookie, profileId: response.json().profile.id as string };
  }

  async function createSpace(
    cookie: string,
    input: { name: string; slug: string; description?: string; visibility?: string },
  ) {
    const response = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie },
      payload: input,
    });
    expect(response.statusCode).toBe(200);
    return response.json().space.id as string;
  }

  function searchSpaces(q: string, cookie?: string) {
    return app.inject({
      method: "GET",
      url: `/api/spaces/search?q=${encodeURIComponent(q)}`,
      headers: cookie ? { cookie } : {},
    });
  }

  function searchPeople(q: string, cookie?: string) {
    return app.inject({
      method: "GET",
      url: `/api/people/search?q=${encodeURIComponent(q)}`,
      headers: cookie ? { cookie } : {},
    });
  }

  it("trouve un espace public par son nom, sa description ou son sujet, jamais un privé", async () => {
    const owner = await createProfile("proprietaire");
    const hackathons = await createSpace(owner.cookie, {
      name: "Hackathons et concours",
      slug: "hackathons",
      description: "Équipes, annonces et retours.",
    });
    await createSpace(owner.cookie, {
      name: "Argent mobile",
      slug: "argent-mobile",
      description: "Wave, Orange Money et les autres.",
    });
    await createSpace(owner.cookie, {
      name: "Hackathon secret",
      slug: "hackathon-secret",
      visibility: "private",
    });

    const byName = (await searchSpaces("hackathon")).json().items;
    expect(byName.map((space: { name: string }) => space.name)).toEqual(["Hackathons et concours"]);
    expect(byName[0]).toMatchObject({ id: hackathons, role: null, memberCount: 1 });

    const byDescription = (await searchSpaces("equipes")).json().items;
    expect(byDescription.map((space: { slug: string }) => space.slug)).toEqual(["hackathons"]);

    // "paiements" n'est écrit nulle part : le sujet Fintech relie le mot à "Wave".
    const byTopic = (await searchSpaces("paiements")).json().items;
    expect(byTopic.map((space: { slug: string }) => space.slug)).toEqual(["argent-mobile"]);

    // Même la propriétaire de l'espace privé ne le retrouve pas par cette recherche.
    const asOwner = (await searchSpaces("secret", owner.cookie)).json().items;
    expect(asOwner).toEqual([]);
  });

  it("donne le rôle de la personne connectée, demande chaque mot et valide la requête", async () => {
    const owner = await createProfile("proprietaire");
    await createSpace(owner.cookie, { name: "Hackathons et concours", slug: "hackathons" });
    const [hit] = (await searchSpaces("hackathons", owner.cookie)).json().items;
    expect(hit.role).toBe("owner");

    // À score égal, le plus peuplé passe devant, même s'il est plus ancien.
    const member = await createProfile("membre");
    await createSpace(owner.cookie, { name: "Hackathons du soir", slug: "hackathons-soir" });
    await app.inject({
      method: "POST",
      url: `/api/spaces/${hit.id}/join`,
      headers: { cookie: member.cookie },
    });
    const ranked = (await searchSpaces("hackathons")).json().items;
    expect(ranked.map((space: { slug: string }) => space.slug)).toEqual([
      "hackathons",
      "hackathons-soir",
    ]);
    expect((await searchSpaces("hackathons cuisine")).json().items).toEqual([]);
    expect((await searchSpaces("%")).json().items).toEqual([]);
    expect((await searchSpaces("   ")).statusCode).toBe(400);
    expect((await searchSpaces("x".repeat(61))).statusCode).toBe(400);
  });

  it("trouve une personne par nom ou identifiant, sans figurant, Kocc, compte bloqué ni suspendu", async () => {
    const viewer = await createProfile("lecteur", "Lecteur");
    await createProfile("awa-ndiaye", "Awa Ndiaye");
    await createProfile("awa-diop", "Awa Diop");
    const blocked = await createProfile("awa-bloquee", "Awa Bloquée");
    const blocker = await createProfile("awa-bloqueuse", "Awa Bloqueuse");
    const suspended = await createProfile("awa-suspendue", "Awa Suspendue");
    const filler = await createProfile("awa-figurante", "Awa Figurante");
    await createProfile("moussa-awa", "Moussa Sow");

    await app.inject({
      method: "PUT",
      url: "/api/users/awa-bloquee/block",
      headers: { cookie: viewer.cookie },
    });
    await app.inject({
      method: "PUT",
      url: "/api/users/lecteur/block",
      headers: { cookie: blocker.cookie },
    });
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, suspended.profileId));
    await db.update(profiles).set({ isFiller: true }).where(eq(profiles.id, filler.profileId));
    expect(blocked.profileId).toBeDefined();

    const handles = (await searchPeople("awa", viewer.cookie))
      .json()
      .items.map((person: { handle: string }) => person.handle);
    // Le début du nom passe avant une correspondance au milieu de l'identifiant.
    expect(handles).toEqual(["awa-diop", "awa-ndiaye", "moussa-awa"]);

    expect((await searchPeople("kocc", viewer.cookie)).json().items).toEqual([]);
    expect((await searchPeople("kemet", viewer.cookie)).json().items).toEqual([]);
    expect((await searchPeople("lecteur", viewer.cookie)).json().items).toEqual([]);
  });

  it("ne trouve ni espace archivé ni l'espace système des discussions de travaux", async () => {
    const owner = await createProfile("proprietaire");
    const archived = await createSpace(owner.cookie, {
      name: "Hackathons d'hier",
      slug: "hackathons-hier",
    });
    await db.update(spaces).set({ archivedAt: new Date() }).where(eq(spaces.id, archived));
    expect((await searchSpaces("hackathons", owner.cookie)).json().items).toEqual([]);

    const [system] = await db.select().from(spaces).where(eq(spaces.id, WORK_DISCUSSIONS_SPACE_ID));
    expect(system?.visibility).toBe("public");
    expect((await searchSpaces("discussions", owner.cookie)).json().items).toEqual([]);
  });

  it("ne trouve pas un compte supprimé et lit _ comme un caractère", async () => {
    const viewer = await createProfile("lecteur", "Lecteur");
    const gone = await createProfile("awa-partie", "Awa Partie");
    await createProfile("awa-tiret", "Awa_Bas");
    await createProfile("awa-autre", "Awa Autre");
    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.id, gone.profileId));

    const handles = (query: string) =>
      searchPeople(query, viewer.cookie).then((response) =>
        response.json().items.map((person: { handle: string }) => person.handle),
      );
    expect(await handles("awa")).toEqual(["awa-autre", "awa-tiret"]);
    expect(await handles("_")).toEqual(["awa-tiret"]);
    expect(await handles("a_b")).toEqual(["awa-tiret"]);
  });

  it("refuse la recherche de personnes à un visiteur", async () => {
    expect((await searchPeople("awa")).statusCode).toBe(401);
  });
});
