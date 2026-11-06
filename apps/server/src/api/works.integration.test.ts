import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  createDb,
  pointsLedger,
  posts,
  profiles,
  WORK_DISCUSSIONS_SPACE_ID,
  workAuthors,
  works,
  type Db,
} from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

// Plus petit PDF que file-type reconnaît : la signature suffit.
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

function buildMultipartBody(
  filename: string,
  contentType: string,
  data: Buffer,
  boundary: string,
): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Travaux (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let auth: ReturnType<typeof createAuth>;

  // Un pool par test, jamais fermé, finissait par dépasser le nombre de
  // connexions autorisées par Postgres ("too many clients").
  afterEach(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    // Tous les comptes de test sont neufs : sans ce facteur, la limite des
    // comptes neufs couperait les tests qui enchaînent plusieurs envois.
    app = buildApp({
      db,
      auth,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1 },
    });
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(
    handle: string,
  ): Promise<{ cookie: string; profileId: string; handle: string }> {
    const email = `${handle}@test.kemet`;
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: handle },
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
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: me.json().profile.id as string, handle };
  }

  function createWork(cookie: string, overrides: Record<string, unknown> = {}) {
    return app.inject({
      method: "POST",
      url: "/api/works",
      headers: { cookie },
      payload: {
        slug: "memoire-test",
        title: "Synchronisation hors ligne sur mobile",
        type: "thesis_research",
        summary:
          "Un mémoire sur la file d'opérations locale et la résolution de conflits hors ligne.",
        tags: ["Hors-ligne", "mobile"],
        stack: ["Flutter"],
        publishRightConfirmed: true,
        links: [{ type: "github", url: "https://github.com/exemple/memoire" }],
        ...overrides,
      },
    });
  }

  function uploadPdf(cookie: string, data: Buffer = PDF_BYTES, filename = "memoire.pdf") {
    const boundary = "----kemettestboundary";
    return app.inject({
      method: "POST",
      url: "/api/works/attachments",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartBody(filename, "application/pdf", data, boundary),
    });
  }

  it("publie un travail, l'annonce dans le fil sans verser de points, et le rend lisible par un visiteur", async () => {
    const author = await createMember("autrice");
    const created = await createWork(author.cookie);
    expect(created.statusCode).toBe(200);
    expect(created.json().work.tags).toEqual(["hors-ligne", "mobile"]);
    expect(created.json().work.viewerRole).toBe("publisher");

    const visitorRead = await app.inject({ method: "GET", url: "/api/works/memoire-test" });
    expect(visitorRead.statusCode).toBe(200);
    expect(visitorRead.json().work.viewerRole).toBeNull();
    expect(visitorRead.json().work.invitations).toBeNull();

    const feed = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" });
    const announcement = feed.json().items.find((item: { work: unknown }) => item.work !== null);
    expect(announcement.work.slug).toBe("memoire-test");
    expect(announcement.authorHandle).toBe("autrice");

    const ledger = await db
      .select()
      .from(pointsLedger)
      .where(eq(pointsLedger.profileId, author.profileId));
    expect(ledger).toHaveLength(0);
  });

  it("cherche par titre, tag ou nom d'auteur, et filtre par statut", async () => {
    const kwame = await createMember("kwame");
    const nadia = await createMember("nadia");
    await createWork(kwame.cookie);
    await createWork(nadia.cookie, {
      slug: "capteurs-lora",
      title: "Capteurs de sol LoRa sur une pile",
      summary: "Des capteurs d'humidité qui tiennent une saison entière sur une seule pile.",
      tags: ["iot"],
      stack: ["C"],
      status: "in_progress",
    });

    async function slugsFor(query: string) {
      const response = await app.inject({ method: "GET", url: `/api/works?${query}` });
      expect(response.statusCode).toBe(200);
      return (response.json().items as { slug: string }[]).map((item) => item.slug);
    }

    expect(await slugsFor("q=synchronisation")).toEqual(["memoire-test"]);
    expect(await slugsFor("q=iot")).toEqual(["capteurs-lora"]);
    expect(await slugsFor("q=nadia")).toEqual(["capteurs-lora"]);
    expect(await slugsFor("status=in_progress")).toEqual(["capteurs-lora"]);
    expect(await slugsFor("status=completed")).toEqual(["memoire-test"]);
    expect(await slugsFor(`q=${encodeURIComponent("100%_")}`)).toEqual([]);

    const detail = await app.inject({ method: "GET", url: "/api/works/capteurs-lora" });
    expect(detail.json().work).toMatchObject({
      status: "in_progress",
      publisher: { handle: "nadia", level: "apprenti" },
    });
  });

  it("trouve un travail par le nom d'un coauteur une fois accepté, ou d'un auteur sans compte", async () => {
    const author = await createMember("autrice");
    const binome = await createMember("binome");
    await createWork(author.cookie, {
      coauthorHandles: ["binome"],
      externalAuthors: ["Ousmane Sarr"],
    });
    await createWork(author.cookie, { slug: "autre-travail", title: "Un autre travail publié" });

    async function slugsFor(q: string) {
      const response = await app.inject({
        method: "GET",
        url: `/api/works?q=${encodeURIComponent(q)}`,
      });
      return (response.json().items as { slug: string }[]).map((item) => item.slug);
    }

    expect(await slugsFor("binome")).toEqual([]);
    expect(await slugsFor("Ousmane")).toEqual(["memoire-test"]);

    const accept = await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: binome.cookie },
      payload: { accepted: true },
    });
    expect(accept.statusCode).toBe(200);
    expect(await slugsFor("binome")).toEqual(["memoire-test"]);
  });

  it("ouvre une discussion publique à la publication, absente de la liste des espaces", async () => {
    const kwame = await createMember("kwame");
    const lecteur = await createMember("lecteur");
    await createWork(kwame.cookie);
    await createWork(kwame.cookie, { slug: "second-travail", title: "Un second travail publié" });

    const work = (await app.inject({ method: "GET", url: "/api/works/second-travail" })).json()
      .work as { discussionChannelId: string; participantCount: number };
    expect(work.discussionChannelId).toEqual(expect.any(String));
    expect(work.participantCount).toBe(0);

    const spaces = await app.inject({
      method: "GET",
      url: "/api/spaces",
      headers: { cookie: lecteur.cookie },
    });
    expect(spaces.json().items).toEqual([]);

    const written = await app.inject({
      method: "POST",
      url: `/api/channels/${work.discussionChannelId}/messages`,
      headers: { cookie: lecteur.cookie },
      payload: { clientId: crypto.randomUUID(), body: "Comment avez-vous testé la reprise ?" },
    });
    expect(written.statusCode).toBe(200);

    const asVisitor = await app.inject({
      method: "GET",
      url: `/api/channels/${work.discussionChannelId}/messages`,
    });
    expect(asVisitor.statusCode).toBe(200);
    expect(asVisitor.json().items).toHaveLength(1);

    const visitorWrite = await app.inject({
      method: "POST",
      url: `/api/channels/${work.discussionChannelId}/messages`,
      payload: { clientId: crypto.randomUUID(), body: "Sans compte" },
    });
    expect(visitorWrite.statusCode).toBe(401);

    const after = (await app.inject({ method: "GET", url: "/api/works/second-travail" })).json()
      .work;
    expect(after.participantCount).toBe(1);

    const discussed = (await app.inject({ method: "GET", url: "/api/works?sort=discussed" })).json()
      .items as { slug: string; messageCount: number }[];
    expect(discussed.map((item) => [item.slug, item.messageCount])).toEqual([
      ["second-travail", 1],
      ["memoire-test", 0],
    ]);
  });

  it("réserve l'espace des discussions : son slug est pris, personne n'y administre rien", async () => {
    const kwame = await createMember("kwame");
    const squat = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: kwame.cookie },
      payload: { name: "Squat", slug: "discussions-des-travaux", visibility: "public" },
    });
    expect(squat.statusCode).toBe(409);
    expect((await createWork(kwame.cookie)).statusCode).toBe(200);
    const work = (await app.inject({ method: "GET", url: "/api/works/memoire-test" })).json()
      .work as { discussionChannelId: string };

    const channels = await app.inject({
      method: "GET",
      url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/channels`,
    });
    expect(channels.statusCode).toBe(200);
    expect(channels.json().items.map((channel: { id: string }) => channel.id)).toEqual([
      work.discussionChannelId,
    ]);

    const attempts = [
      {
        method: "POST" as const,
        url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/channels`,
        payload: { name: "annexe", slug: "annexe" },
      },
      {
        method: "PATCH" as const,
        url: `/api/channels/${work.discussionChannelId}`,
        payload: { name: "Renommé à la main" },
      },
      {
        method: "POST" as const,
        url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/invites`,
        payload: {},
      },
      {
        method: "POST" as const,
        url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/members`,
        payload: { handle: "kwame" },
      },
    ];
    for (const attempt of attempts) {
      const response = await app.inject({ ...attempt, headers: { cookie: kwame.cookie } });
      expect(response.statusCode, `${attempt.method} ${attempt.url}`).toBe(403);
    }
  });

  it("refuse d'écrire dans une discussion à un compte suspendu ou sans profil", async () => {
    const kwame = await createMember("kwame");
    const suspended = await createMember("suspendu");
    await createWork(kwame.cookie);
    const work = (await app.inject({ method: "GET", url: "/api/works/memoire-test" })).json()
      .work as { discussionChannelId: string };
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, suspended.profileId));

    const email = "sans-profil@test.kemet";
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name: "sans profil" },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const noProfile = extractCookie(
      await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        payload: { email, password: "une-passphrase-solide" },
      }),
    );

    for (const [cookie, status] of [
      [suspended.cookie, 403],
      [noProfile, 400],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: `/api/channels/${work.discussionChannelId}/messages`,
        headers: { cookie },
        payload: { clientId: crypto.randomUUID(), body: "Bonjour" },
      });
      expect(response.statusCode).toBe(status);
    }
  });

  it("renomme la discussion avec le travail, et la supprime avec lui", async () => {
    const kwame = await createMember("kwame");
    const lecteur = await createMember("lecteur");
    await createWork(kwame.cookie);
    const work = (await app.inject({ method: "GET", url: "/api/works/memoire-test" })).json()
      .work as { discussionChannelId: string };
    await app.inject({
      method: "POST",
      url: `/api/channels/${work.discussionChannelId}/messages`,
      headers: { cookie: lecteur.cookie },
      payload: { clientId: crypto.randomUUID(), body: "Une question sur la reprise" },
    });

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/works/memoire-test",
      headers: { cookie: kwame.cookie },
      payload: { title: "Synchronisation hors ligne, version finale" },
    });
    expect(patch.statusCode).toBe(200);
    const listed = await app.inject({
      method: "GET",
      url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/channels`,
    });
    expect(listed.json().items[0].name).toBe("Synchronisation hors ligne, version finale");

    const remove = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test",
      headers: { cookie: kwame.cookie },
    });
    expect(remove.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/spaces/${WORK_DISCUSSIONS_SPACE_ID}/channels`,
        })
      ).json().items,
    ).toEqual([]);
    const read = await app.inject({
      method: "GET",
      url: `/api/channels/${work.discussionChannelId}/messages`,
    });
    expect(read.statusCode).toBe(404);
    const write = await app.inject({
      method: "POST",
      url: `/api/channels/${work.discussionChannelId}/messages`,
      headers: { cookie: lecteur.cookie },
      payload: { clientId: crypto.randomUUID(), body: "Encore là ?" },
    });
    expect(write.statusCode).toBe(404);
  });

  it("efface le PDF et les invitations en attente d'un compte supprimé, sans le laisser trouver", async () => {
    const author = await createMember("autrice");
    const invited = await createMember("invitee");
    const upload = await uploadPdf(author.cookie);
    const attachmentId = upload.json().attachment.id as string;
    await createWork(author.cookie, { attachmentId });
    await createWork(author.cookie, {
      slug: "autre-travail",
      title: "Un autre travail publié",
      attachmentId: undefined,
    });
    await createWork(invited.cookie, {
      slug: "travail-invitee",
      title: "Travail de l'invitée",
      attachmentId: undefined,
      coauthorHandles: ["autrice"],
    });

    const deletion = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: author.cookie },
      payload: { password: "une-passphrase-solide" },
    });
    expect(deletion.statusCode).toBe(204);

    const download = await app.inject({
      method: "GET",
      url: `/api/work-attachments/${attachmentId}/content`,
    });
    expect(download.statusCode).toBe(404);
    const pending = await db
      .select()
      .from(workAuthors)
      .where(eq(workAuthors.profileId, author.profileId));
    expect(pending).toEqual([]);
    const search = await app.inject({
      method: "GET",
      url: `/api/works?q=${encodeURIComponent("Compte supprimé")}`,
    });
    expect(search.json().items).toEqual([]);
  });

  it("refuse un travail sans le droit de publier coché, ou avec un lien qui n'est pas en https", async () => {
    const author = await createMember("autrice");
    expect((await createWork(author.cookie, { publishRightConfirmed: false })).statusCode).toBe(
      400,
    );
    expect(
      (await createWork(author.cookie, { links: [{ type: "site", url: "http://exemple.com" }] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createWork(author.cookie, { links: [{ type: "site", url: "javascript:alert(1)" }] }))
        .statusCode,
    ).toBe(400);
  });

  it("refuse la publication à un visiteur et à un compte suspendu", async () => {
    const visitor = await app.inject({ method: "POST", url: "/api/works", payload: {} });
    expect(visitor.statusCode).toBe(401);

    const suspended = await createMember("suspendu");
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, suspended.profileId));
    expect((await createWork(suspended.cookie)).statusCode).toBe(403);
  });

  it("limite plus fort la publication d'un compte neuf", async () => {
    app = buildApp({ db, auth });
    const author = await createMember("neuve");
    const statuses: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      statuses.push((await createWork(author.cookie, { slug: `travail-${index}` })).statusCode);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("filtre la liste par type et par tag, et la pagine par curseur", async () => {
    const author = await createMember("autrice");
    await createWork(author.cookie, { slug: "travail-a", type: "article", tags: ["paiements"] });
    await createWork(author.cookie, { slug: "travail-b", type: "article", tags: ["mobile"] });
    await createWork(author.cookie, { slug: "travail-c", type: "internship", tags: ["mobile"] });

    const articles = await app.inject({ method: "GET", url: "/api/works?type=article" });
    expect(
      articles
        .json()
        .items.map((item: { slug: string }) => item.slug)
        .sort(),
    ).toEqual(["travail-a", "travail-b"]);

    const mobile = await app.inject({ method: "GET", url: "/api/works?tag=Mobile" });
    expect(
      mobile
        .json()
        .items.map((item: { slug: string }) => item.slug)
        .sort(),
    ).toEqual(["travail-b", "travail-c"]);

    const first = await app.inject({ method: "GET", url: "/api/works?limit=2" });
    expect(first.json().items).toHaveLength(2);
    const second = await app.inject({
      method: "GET",
      url: `/api/works?limit=2&cursor=${first.json().nextCursor}`,
    });
    expect(second.json().items).toHaveLength(1);
    expect(second.json().nextCursor).toBeNull();
    const seen = [...first.json().items, ...second.json().items].map(
      (item: { slug: string }) => item.slug,
    );
    expect(new Set(seen).size).toBe(3);
  });

  it("n'affiche jamais un coauteur qui n'a pas accepté, ni sur le travail ni sur son profil", async () => {
    const author = await createMember("autrice");
    const invited = await createMember("invite");
    await createWork(author.cookie, { coauthorHandles: ["invite"] });

    const pending = await app.inject({
      method: "GET",
      url: "/api/works/memoire-test",
      headers: { cookie: invited.cookie },
    });
    expect(pending.json().work.coauthors).toEqual([]);
    expect(pending.json().work.viewerRole).toBe("invited");
    expect(pending.json().work.invitations).toBeNull();
    const other = await createMember("autre");
    const asOther = await app.inject({
      method: "GET",
      url: "/api/works/memoire-test",
      headers: { cookie: other.cookie },
    });
    expect(asOther.json().work.invitations).toBeNull();
    expect(asOther.json().work.viewerRole).toBeNull();
    expect(
      (await app.inject({ method: "GET", url: "/api/users/invite/works" })).json().items,
    ).toEqual([]);

    const invitations = await app.inject({
      method: "GET",
      url: "/api/me/work-invitations",
      headers: { cookie: invited.cookie },
    });
    expect(
      invitations.json().items.map((item: { work: { slug: string } }) => item.work.slug),
    ).toEqual(["memoire-test"]);

    const asPublisher = await app.inject({
      method: "GET",
      url: "/api/works/memoire-test",
      headers: { cookie: author.cookie },
    });
    expect(asPublisher.json().work.invitations).toEqual([
      expect.objectContaining({
        status: "pending",
        person: expect.objectContaining({ handle: "invite" }),
      }),
    ]);

    const accept = await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: invited.cookie },
      payload: { accepted: true },
    });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().work.coauthors.map((person: { handle: string }) => person.handle)).toEqual(
      ["invite"],
    );

    const profileWorks = await app.inject({ method: "GET", url: "/api/users/invite/works" });
    expect(profileWorks.json().items).toEqual([
      expect.objectContaining({ slug: "memoire-test", relation: "coauthored" }),
    ]);
  });

  it("un refus garde le coauteur hors du travail", async () => {
    const author = await createMember("autrice");
    const invited = await createMember("invite");
    await createWork(author.cookie, { coauthorHandles: ["invite"] });

    const decline = await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: invited.cookie },
      payload: { accepted: false },
    });
    expect(decline.statusCode).toBe(200);
    expect(decline.json().work.coauthors).toEqual([]);

    const again = await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: invited.cookie },
      payload: { accepted: true },
    });
    expect(again.statusCode).toBe(409);
  });

  it("seule la personne invitée peut répondre à son invitation", async () => {
    const author = await createMember("autrice");
    await createMember("invite");
    const other = await createMember("autre");
    await createWork(author.cookie, { coauthorHandles: ["invite"] });

    const asOther = await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: other.cookie },
      payload: { accepted: true },
    });
    expect(asOther.statusCode).toBe(404);
    const [row] = await db.select().from(workAuthors);
    expect(row!.status).toBe("pending");
  });

  it("un coauteur ne peut ni modifier ni supprimer le travail", async () => {
    const author = await createMember("autrice");
    const coauthor = await createMember("coauteur");
    await createWork(author.cookie, { coauthorHandles: ["coauteur"] });
    await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: coauthor.cookie },
      payload: { accepted: true },
    });

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/works/memoire-test",
      headers: { cookie: coauthor.cookie },
      payload: { title: "Titre changé par un coauteur" },
    });
    expect(patch.statusCode).toBe(403);
    const remove = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test",
      headers: { cookie: coauthor.cookie },
    });
    expect(remove.statusCode).toBe(403);
    const invite = await app.inject({
      method: "POST",
      url: "/api/works/memoire-test/authors",
      headers: { cookie: coauthor.cookie },
      payload: { handle: "autrice" },
    });
    expect(invite.statusCode).toBe(403);
  });

  it("le publieur modifie son travail, remplace ses liens et le supprime avec son post", async () => {
    const author = await createMember("autrice");
    await createWork(author.cookie);

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/works/memoire-test",
      headers: { cookie: author.cookie },
      payload: {
        title: "Nouveau titre du mémoire",
        links: [
          { type: "drive", url: "https://drive.google.com/file/d/abc/view", label: "Mémoire" },
        ],
        externalAuthors: ["Encadrant sans compte"],
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().work.title).toBe("Nouveau titre du mémoire");
    expect(patch.json().work.links).toEqual([
      expect.objectContaining({ type: "drive", label: "Mémoire" }),
    ]);
    expect(patch.json().work.externalAuthors).toEqual(["Encadrant sans compte"]);

    const remove = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test",
      headers: { cookie: author.cookie },
    });
    expect(remove.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/works/memoire-test" })).statusCode).toBe(
      404,
    );
    const [post] = await db.select().from(posts);
    expect(post!.deletedAt).not.toBeNull();
  });

  it("un coauteur peut se retirer, et ne peut plus être réinvité en boucle", async () => {
    const author = await createMember("autrice");
    const coauthor = await createMember("coauteur");
    await createWork(author.cookie, { coauthorHandles: ["coauteur"] });
    await app.inject({
      method: "PUT",
      url: "/api/works/memoire-test/invitation",
      headers: { cookie: coauthor.cookie },
      payload: { accepted: true },
    });

    const withdraw = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test/authors/coauteur",
      headers: { cookie: coauthor.cookie },
    });
    expect(withdraw.statusCode).toBe(200);
    expect(
      (await app.inject({ method: "GET", url: "/api/works/memoire-test" })).json().work.coauthors,
    ).toEqual([]);

    const reinvite = await app.inject({
      method: "POST",
      url: "/api/works/memoire-test/authors",
      headers: { cookie: author.cookie },
      payload: { handle: "coauteur" },
    });
    expect(reinvite.statusCode).toBe(409);
  });

  it("seul le publieur retire un coauteur, et personne ne s'invite soi-même ni l'assistant", async () => {
    const author = await createMember("autrice");
    await createMember("coauteur");
    const other = await createMember("autre");
    await createWork(author.cookie, { coauthorHandles: ["coauteur"] });

    const asOther = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test/authors/coauteur",
      headers: { cookie: other.cookie },
    });
    expect(asOther.statusCode).toBe(403);
    const asPublisher = await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test/authors/coauteur",
      headers: { cookie: author.cookie },
    });
    expect(asPublisher.statusCode).toBe(200);

    for (const handle of ["autrice", "kemet", "inconnu"]) {
      const invite = await app.inject({
        method: "POST",
        url: "/api/works/memoire-test/authors",
        headers: { cookie: author.cookie },
        payload: { handle },
      });
      expect(invite.statusCode, handle).toBe(400);
    }
  });

  it("n'accepte qu'un PDF, propre à son auteur, servi en téléchargement", async () => {
    const author = await createMember("autrice");
    const other = await createMember("autre");

    expect((await uploadPdf(author.cookie, PNG_BYTES, "image.pdf")).statusCode).toBe(400);
    const othersPdf = await uploadPdf(other.cookie);
    expect(
      (await createWork(author.cookie, { attachmentId: othersPdf.json().attachment.id }))
        .statusCode,
    ).toBe(400);

    const upload = await uploadPdf(author.cookie);
    expect(upload.statusCode).toBe(200);
    const created = await createWork(author.cookie, { attachmentId: upload.json().attachment.id });
    expect(created.json().work.attachment.id).toBe(upload.json().attachment.id);

    const download = await app.inject({
      method: "GET",
      url: `/api/work-attachments/${upload.json().attachment.id}/content`,
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toBe("application/pdf");
    expect(download.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(download.headers["x-content-type-options"]).toBe("nosniff");

    const pending = await uploadPdf(author.cookie);
    const unattached = await app.inject({
      method: "GET",
      url: `/api/work-attachments/${pending.json().attachment.id}/content`,
    });
    expect(unattached.statusCode).toBe(404);
  });

  it("sert un PDF au nom non ASCII, et plus rien une fois le travail supprimé", async () => {
    const author = await createMember("autrice");
    const other = await createMember("autre");
    const upload = await uploadPdf(author.cookie, PDF_BYTES, "Mémoire d’ingénieur.pdf");
    const attachmentId = upload.json().attachment.id as string;
    await createWork(author.cookie, { attachmentId });

    const download = await app.inject({
      method: "GET",
      url: `/api/work-attachments/${attachmentId}/content`,
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-disposition"]).toContain(
      `filename*=UTF-8''${encodeURIComponent("Mémoire d’ingénieur.pdf")}`,
    );
    expect(
      (await app.inject({ method: "GET", url: "/api/work-attachments/pas-un-uuid/content" }))
        .statusCode,
    ).toBe(400);

    const othersPdf = await uploadPdf(other.cookie);
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/works/memoire-test",
      headers: { cookie: author.cookie },
      payload: { attachmentId: othersPdf.json().attachment.id },
    });
    expect(patch.statusCode).toBe(400);

    await app.inject({
      method: "DELETE",
      url: "/api/works/memoire-test",
      headers: { cookie: author.cookie },
    });
    const afterDelete = await app.inject({
      method: "GET",
      url: `/api/work-attachments/${attachmentId}/content`,
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it("accepte un lien en HTTPS majuscule en le normalisant", async () => {
    const author = await createMember("autrice");
    const created = await createWork(author.cookie, {
      links: [{ type: "site", url: "HTTPS://Exemple.org/Page" }],
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().work.links[0].url).toBe("https://exemple.org/Page");
  });

  it("compte les PDF de travaux dans le même quota que les images de post", async () => {
    app = buildApp({
      db,
      auth,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1 },
      attachmentLimits: {
        maxAttachmentBytes: 1024 * 1024,
        maxUserStorageBytes: PDF_BYTES.length + PNG_BYTES.length - 1,
      },
    });
    const author = await createMember("autrice");
    expect((await uploadPdf(author.cookie)).statusCode).toBe(200);

    const boundary = "----kemettestboundary";
    const image = await app.inject({
      method: "POST",
      url: "/api/posts/attachments",
      headers: {
        cookie: author.cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipartBody("image.png", "image/png", PNG_BYTES, boundary),
    });
    expect(image.statusCode).toBe(400);
    expect(image.json().error.message).toContain("Quota");

    const other = await createMember("autre");
    const otherImage = await app.inject({
      method: "POST",
      url: "/api/posts/attachments",
      headers: {
        cookie: other.cookie,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: buildMultipartBody("image.png", "image/png", PNG_BYTES, boundary),
    });
    expect(otherImage.statusCode).toBe(200);
    const otherPdf = await uploadPdf(other.cookie);
    expect(otherPdf.statusCode).toBe(400);
  });

  // Trois comptes à créer, chacun avec un hachage Argon2 : 4,7 s seul,
  // au-delà des 5 s par défaut dès que la machine est chargée.
  it("se signale par le module de modération, et un admin peut le masquer", async () => {
    const author = await createMember("autrice");
    const reporter = await createMember("signaleur");
    const admin = await createMember("admin");
    await db
      .update(profiles)
      .set({ isPlatformAdmin: true })
      .where(eq(profiles.id, admin.profileId));
    const workId = (await createWork(author.cookie)).json().work.id as string;

    const self = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie: author.cookie },
      payload: { targetType: "work", targetId: workId, reason: "test" },
    });
    expect(self.statusCode).toBe(400);

    const report = await app.inject({
      method: "POST",
      url: "/api/reports",
      headers: { cookie: reporter.cookie },
      payload: {
        targetType: "work",
        targetId: workId,
        reason: "Travail copié d'un autre étudiant.",
      },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().report.targetSummary).toBe("Synchronisation hors ligne sur mobile");

    const hide = await app.inject({
      method: "PUT",
      url: `/api/reports/${report.json().report.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "hide" },
    });
    expect(hide.statusCode).toBe(200);
    const [row] = await db.select().from(works).where(eq(works.id, workId));
    expect(row!.deletedAt).not.toBeNull();
  }, 15_000);
});
