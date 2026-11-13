import { randomUUID } from "node:crypto";
import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  BEGINNERS_SPACE_ID,
  createDb,
  pointsLedger,
  posts,
  profileBlocks,
  profileCvs,
  profiles,
  type Db,
} from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);
const BOUNDARY = "----kemetcvboundary";

function multipart(filename: string, contentType: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Bibliothèque du profil et débutants (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let storage: InMemoryStorage;
  let auth: ReturnType<typeof createAuth>;

  afterEach(async () => {
    await db.$client.end();
  });

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    storage = new InMemoryStorage();
    auth = createAuth({
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

  async function createMember(handle: string, extra: Record<string, unknown> = {}) {
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
    const raw = signIn.headers["set-cookie"];
    const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN", ...extra },
    });
    return { cookie, profileId: me.json().profile.id as string, handle };
  }

  function uploadCv(cookie: string, data = PDF_BYTES, filename = "cv.pdf", type = "application/pdf") {
    return app.inject({
      method: "POST",
      url: "/api/me/cv",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart(filename, type, data),
    });
  }

  it("garde un CV en PDF, réservé aux comptes connectés par défaut, puis public sur demande", async () => {
    const owner = await createMember("awa");
    const reader = await createMember("binta");

    const refused = await uploadCv(owner.cookie, PNG_BYTES, "cv.pdf", "application/pdf");
    expect(refused.statusCode).toBe(400);

    const uploaded = await uploadCv(owner.cookie);
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json().cv).toMatchObject({ originalName: "cv.pdf", visibility: "members" });

    const visitorLibrary = await app.inject({ method: "GET", url: "/api/users/awa/library" });
    expect(visitorLibrary.json().cv).toMatchObject({ available: false });
    const visitorContent = await app.inject({ method: "GET", url: "/api/users/awa/cv/content" });
    expect(visitorContent.statusCode).toBe(401);

    const readerContent = await app.inject({
      method: "GET",
      url: "/api/users/awa/cv/content",
      headers: { cookie: reader.cookie },
    });
    expect(readerContent.statusCode).toBe(200);
    expect(readerContent.headers["content-disposition"]).toMatch(/^attachment/);
    expect(readerContent.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(readerContent.headers["x-content-type-options"]).toBe("nosniff");

    const madePublic = await app.inject({
      method: "PATCH",
      url: "/api/me/cv",
      headers: { cookie: owner.cookie },
      payload: { visibility: "public" },
    });
    expect(madePublic.json().cv.visibility).toBe("public");
    const publicContent = await app.inject({ method: "GET", url: "/api/users/awa/cv/content" });
    expect(publicContent.statusCode).toBe(200);
    expect(publicContent.rawPayload.equals(PDF_BYTES)).toBe(true);
  });

  it("remplace l'ancien fichier, et le retire du disque à la suppression", async () => {
    const owner = await createMember("awa");
    const storedKey = async () =>
      (await db.select().from(profileCvs).where(eq(profileCvs.profileId, owner.profileId)))[0]?.storageKey;
    await uploadCv(owner.cookie);
    const firstKey = (await storedKey())!;

    const replaced = await uploadCv(owner.cookie, PDF_BYTES, "cv-2026.pdf");
    expect(replaced.json().cv.originalName).toBe("cv-2026.pdf");
    const secondKey = (await storedKey())!;
    expect(secondKey).not.toBe(firstKey);
    expect(() => storage.read(firstKey)).toThrow();

    const removed = await app.inject({ method: "DELETE", url: "/api/me/cv", headers: { cookie: owner.cookie } });
    expect(removed.statusCode).toBe(200);
    expect(() => storage.read(secondKey)).toThrow();
    expect(await storedKey()).toBeUndefined();
    const library = await app.inject({ method: "GET", url: "/api/users/awa/library" });
    expect(library.json().cv).toBeNull();
  });

  it("refuse un CV à un visiteur et à un compte suspendu", async () => {
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/me/cv",
      headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart("cv.pdf", "application/pdf", PDF_BYTES),
    });
    expect(anonymous.statusCode).toBe(401);

    const suspended = await createMember("awa");
    expect((await uploadCv(suspended.cookie)).statusCode).toBe(200);
    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, suspended.profileId));
    expect((await uploadCv(suspended.cookie)).statusCode).toBe(403);
    const changed = await app.inject({
      method: "PATCH",
      url: "/api/me/cv",
      headers: { cookie: suspended.cookie },
      payload: { visibility: "public" },
    });
    expect(changed.statusCode).toBe(403);
    const removed = await app.inject({ method: "DELETE", url: "/api/me/cv", headers: { cookie: suspended.cookie } });
    expect(removed.statusCode).toBe(403);
    expect(await db.$count(profileCvs, eq(profileCvs.profileId, suspended.profileId))).toBe(1);
  });

  it("ne sert ni la bibliothèque ni le CV d'un compte supprimé ou d'un figurant", async () => {
    const deleted = await createMember("partie");
    const filler = await createMember("figurant");
    for (const member of [deleted, filler]) {
      await uploadCv(member.cookie);
      await app.inject({
        method: "PATCH",
        url: "/api/me/cv",
        headers: { cookie: member.cookie },
        payload: { visibility: "public" },
      });
    }
    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.id, deleted.profileId));
    await db.update(profiles).set({ isFiller: true }).where(eq(profiles.id, filler.profileId));

    for (const handle of ["partie", "figurant"]) {
      expect((await app.inject({ method: "GET", url: `/api/users/${handle}/library` })).statusCode).toBe(404);
      expect((await app.inject({ method: "GET", url: `/api/users/${handle}/cv/content` })).statusCode).toBe(404);
    }
  });

  it("refuse un CV qui dépasserait le quota de stockage commun", async () => {
    app = buildApp({
      db,
      auth,
      storage,
      attachmentLimits: { maxAttachmentBytes: 1024 * 1024, maxUserStorageBytes: PDF_BYTES.length - 1 },
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 3 },
    });
    const owner = await createMember("awa");
    const refused = await uploadCv(owner.cookie);
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error.message).toMatch(/Quota/);
    expect(await db.$count(profileCvs)).toBe(0);
  });

  it("montre les projets et les seuls skills publics de la personne", async () => {
    const owner = await createMember("awa");
    await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: owner.cookie },
      payload: {
        slug: "carnet-de-sante",
        name: "Carnet de santé",
        pitch: "Un carnet de vaccination hors ligne pour les centres de santé.",
        repoUrl: "https://github.com/awa/carnet",
        stack: ["Flutter"],
      },
    });
    for (const visibility of ["public", "private"] as const) {
      await app.inject({
        method: "POST",
        url: "/api/skills",
        headers: { cookie: owner.cookie },
        payload: {
          slug: `skill-${visibility}`,
          name: `Skill ${visibility}`,
          description: "Un skill pour tester la bibliothèque du profil.",
          content: "Contenu",
          visibility,
        },
      });
    }

    const library = await app.inject({ method: "GET", url: "/api/users/awa/library", headers: { cookie: owner.cookie } });
    expect(library.json().projects.map((project: { slug: string }) => project.slug)).toEqual(["carnet-de-sante"]);
    expect(library.json().skills.map((skill: { slug: string }) => skill.slug)).toEqual(["skill-public"]);
  });

  it("n'accepte un lien de forge ou de réseau que vers ce service, en https", async () => {
    const owner = await createMember("awa");
    const wrongHost = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: owner.cookie },
      payload: { gitlabUrl: "https://github.com/awa" },
    });
    expect(wrongHost.statusCode).toBe(400);
    const plainHttp = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: owner.cookie },
      payload: { websiteUrl: "http://awa.dev" },
    });
    expect(plainHttp.statusCode).toBe(400);

    const saved = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: owner.cookie },
      payload: {
        gitlabUrl: "https://gitlab.com/awa",
        linkedinUrl: "https://sn.linkedin.com/in/awa",
        portfolioUrl: "https://awa.dev",
        helpsBeginners: true,
      },
    });
    expect(saved.json().profile).toMatchObject({
      gitlabUrl: "https://gitlab.com/awa",
      linkedinUrl: "https://sn.linkedin.com/in/awa",
      portfolioUrl: "https://awa.dev",
      helpsBeginners: true,
    });
  });

  it("filtre les posts et les skills marqués Débutant", async () => {
    const author = await createMember("awa");
    await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: author.cookie },
      payload: { body: "Par quel langage commencer ?", isBeginner: true },
    });
    await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: author.cookie },
      payload: { body: "Réglage fin de PostgreSQL pour les gros index." },
    });
    const feed = await app.inject({ method: "GET", url: "/api/posts?tab=debuter" });
    expect(feed.json().items.map((post: { body: string }) => post.body)).toEqual(["Par quel langage commencer ?"]);
    expect(feed.json().items[0].isBeginner).toBe(true);

    for (const isBeginner of [true, false]) {
      await app.inject({
        method: "POST",
        url: "/api/skills",
        headers: { cookie: author.cookie },
        payload: {
          slug: isBeginner ? "premiers-pas-git" : "index-postgres",
          name: isBeginner ? "Premiers pas avec Git" : "Index PostgreSQL",
          description: "Un skill pour tester le filtre Pour débuter.",
          content: "Contenu",
          isBeginner,
        },
      });
    }
    const skills = await app.inject({ method: "GET", url: "/api/skills?beginner=1" });
    expect(skills.json().items.map((skill: { slug: string }) => skill.slug)).toEqual(["premiers-pas-git"]);
  });

  it("propose l'espace des débutants en premier à un étudiant, et ceux qui les aident d'abord", async () => {
    const helper = await createMember("mentor", { helpsBeginners: true });
    await createMember("autre");
    const student = await createMember("etudiant", { role: "student" });
    expect(helper.profileId).toBeTruthy();

    const spaces = await app.inject({ method: "GET", url: "/api/me/onboarding/spaces", headers: { cookie: student.cookie } });
    expect(spaces.json().items[0].id).toBe(BEGINNERS_SPACE_ID);
    const people = await app.inject({ method: "GET", url: "/api/me/onboarding/people", headers: { cookie: student.cookie } });
    expect(people.json().items[0].profile).toMatchObject({ handle: "mentor", helpsBeginners: true });

    const developer = await createMember("dev", { role: "developer" });
    await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: { cookie: developer.cookie },
      payload: { interests: ["backend"] },
    });
    const devSpaces = await app.inject({ method: "GET", url: "/api/me/onboarding/spaces", headers: { cookie: developer.cookie } });
    expect(devSpaces.json().items.map((item: { id: string }) => item.id)).not.toContain(BEGINNERS_SPACE_ID);
  });

  it("met les travaux devant le code dans le fil Pour toi d'un compte RH, jamais pour un développeur", async () => {
    const author = await createMember("awa");
    const older = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: author.cookie },
      payload: { body: "Mon mémoire sur la logistique du dernier kilomètre est publié." },
    });
    await db
      .update(posts)
      .set({ workId: null, createdAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(posts.id, older.json().post.id));
    await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: author.cookie },
      payload: { body: "Astuce :\n```sql\nselect 1;\n```" },
    });
    const work = await app.inject({
      method: "POST",
      url: "/api/works",
      headers: { cookie: author.cookie },
      payload: {
        slug: "memoire-logistique",
        title: "Logistique du dernier kilomètre",
        type: "thesis_research",
        summary: "Un mémoire sur la logistique du dernier kilomètre dans les villes d'Afrique de l'Ouest.",
        tags: ["logistique"],
        stack: [],
        publishRightConfirmed: true,
        links: [],
      },
    });
    expect(work.statusCode).toBe(200);
    // Le post d'annonce du travail devient le plus ancien des trois.
    await db
      .update(posts)
      .set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(posts.workId, work.json().work.id));

    const recruiter = await createMember("recruteuse", { role: "hr" });
    const developer = await createMember("dev", { role: "developer" });
    const forRecruiter = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi", headers: { cookie: recruiter.cookie } });
    const forDeveloper = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi", headers: { cookie: developer.cookie } });
    expect(forRecruiter.json().items[0].work?.slug).toBe("memoire-logistique");
    expect(forRecruiter.json().items.at(-1).body).toContain("```sql");
    expect(forDeveloper.json().items[0].body).toContain("```sql");
  });

  it("ne montre dans les cartes Profils ouverts que les personnes au niveau requis", async () => {
    const confirmed = await createMember("confirmee");
    const beginner = await createMember("novice");
    await db.update(profiles).set({ openToOpportunities: true }).where(eq(profiles.id, beginner.profileId));
    await db.insert(pointsLedger).values({
      profileId: confirmed.profileId,
      source: "credential_verified",
      sourceId: randomUUID(),
      amount: 400,
    });
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie: confirmed.cookie },
      payload: { openToOpportunities: true },
    });

    const cards = await app.inject({ method: "GET", url: "/api/feed/open-profiles" });
    expect(cards.json().items.map((profile: { handle: string }) => profile.handle)).toEqual(["confirmee"]);
  });

  it("n'y montre ni figurant, ni compte suspendu ou supprimé, ni personne bloquée", async () => {
    const reader = await createMember("lectrice");
    const handles = ["figurant", "suspendue", "partie", "bloquee", "visible"];
    const members = await Promise.all(handles.map((handle) => createMember(handle)));
    for (const member of members) {
      await db.insert(pointsLedger).values({
        profileId: member.profileId,
        source: "credential_verified",
        sourceId: randomUUID(),
        amount: 400,
      });
      await db.update(profiles).set({ openToOpportunities: true }).where(eq(profiles.id, member.profileId));
    }
    const [filler, suspended, deleted, blocked] = members;
    await db.update(profiles).set({ isFiller: true }).where(eq(profiles.id, filler!.profileId));
    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, suspended!.profileId));
    await db.update(profiles).set({ deletedAt: new Date() }).where(eq(profiles.id, deleted!.profileId));
    await db.insert(profileBlocks).values({ blockerId: blocked!.profileId, blockedId: reader.profileId });

    const shown = async (cookie?: string) =>
      (
        await app.inject({ method: "GET", url: "/api/feed/open-profiles", headers: cookie ? { cookie } : {} })
      )
        .json()
        .items.map((profile: { handle: string }) => profile.handle)
        .sort();
    expect(await shown(reader.cookie)).toEqual(["visible"]);
    expect(await shown()).toEqual(["bloquee", "visible"]);
  });
});
