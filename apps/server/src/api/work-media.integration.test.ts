import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { cleanupOrphanWorkMedia } from "../works/work-attachments-cleanup.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);
// Plus petits en-têtes que file-type reconnaît comme MP4 et WebM.
const MP4_BYTES = Buffer.from(
  "000000186674797069736f6d0000020069736f6d69736f32" + "00".repeat(64),
  "hex",
);
const WEBM_BYTES = Buffer.from(
  "1a45dfa39f4286810142f7810142f2810442f381084282847765626d4287810442858102" + "00".repeat(64),
  "hex",
);
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

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

describe.skipIf(!databaseUrl)("Médias des travaux (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let storage: InMemoryStorage;

  afterEach(async () => {
    await db.$client.end();
  });

  function createApp(limits?: {
    maxAttachmentBytes: number;
    maxUserStorageBytes: number;
    maxWorkVideoBytes?: number;
  }) {
    const auth = createAuth({
      db,
      emailSender,
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    return buildApp({
      db,
      auth,
      storage,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1 },
      attachmentLimits: limits ?? {
        maxAttachmentBytes: 25 * 1024 * 1024,
        maxUserStorageBytes: 500 * 1024 * 1024,
      },
    });
  }

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    emailSender = new InMemoryEmailSender();
    storage = new InMemoryStorage();
    app = createApp();
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(handle: string): Promise<{ cookie: string; profileId: string }> {
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
    return { cookie, profileId: me.json().profile.id as string };
  }

  function upload(
    cookie: string,
    data: Buffer,
    filename: string,
    contentType = "application/octet-stream",
  ) {
    const boundary = "----kemetmediaboundary";
    return app.inject({
      method: "POST",
      url: "/api/works/media",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartBody(filename, contentType, data, boundary),
    });
  }

  async function uploadId(cookie: string, data: Buffer, filename: string): Promise<string> {
    const response = await upload(cookie, data, filename);
    expect(response.statusCode).toBe(200);
    return response.json().media.id as string;
  }

  function createWork(cookie: string, media?: unknown, slug = "travail-media") {
    return app.inject({
      method: "POST",
      url: "/api/works",
      headers: { cookie },
      payload: {
        slug,
        title: "Un travail avec des images",
        type: "thesis_research",
        summary:
          "Un travail illustré par une couverture, une galerie et une vidéo de démonstration.",
        tags: ["mobile"],
        stack: [],
        publishRightConfirmed: true,
        links: [],
        ...(media === undefined ? {} : { media }),
      },
    });
  }

  it("pose couverture, galerie, vidéo et lien YouTube, lisibles par un visiteur", async () => {
    const author = await createMember("autrice");
    const cover = await uploadId(author.cookie, PNG_BYTES, "couverture.png");
    const shot = await uploadId(author.cookie, PNG_BYTES, "ecran.png");
    const video = await uploadId(author.cookie, MP4_BYTES, "demo.mp4");

    const created = await createWork(author.cookie, {
      media: [
        { id: cover, role: "cover" },
        { id: shot, role: "gallery" },
        { id: video, role: "video" },
      ],
      youtubeUrls: ["https://youtu.be/dQw4w9WgXcQ"],
    });
    expect(created.statusCode).toBe(200);
    const work = created.json().work;
    expect(work.coverMediaId).toBe(cover);
    expect(work.gallery).toEqual([{ id: shot, originalName: "ecran.png" }]);
    expect(work.videos).toEqual([
      { kind: "file", id: video, mimeType: "video/mp4", originalName: "demo.mp4" },
      { kind: "youtube", id: expect.any(String), youtubeId: "dQw4w9WgXcQ" },
    ]);

    const list = await app.inject({ method: "GET", url: "/api/works" });
    expect(list.json().items[0].coverMediaId).toBe(cover);

    const image = await app.inject({ method: "GET", url: `/api/work-media/${cover}/content` });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
    expect(image.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(image.rawPayload.equals(PNG_BYTES)).toBe(true);
  });

  it("sert une vidéo par plages pour le lecteur du navigateur", async () => {
    const author = await createMember("autrice");
    const video = await uploadId(author.cookie, WEBM_BYTES, "demo.webm");
    await createWork(author.cookie, { media: [{ id: video, role: "video" }], youtubeUrls: [] });

    const partial = await app.inject({
      method: "GET",
      url: `/api/work-media/${video}/content`,
      headers: { range: "bytes=0-9" },
    });
    expect(partial.statusCode).toBe(206);
    expect(partial.headers["content-type"]).toBe("video/webm");
    expect(partial.headers["accept-ranges"]).toBe("bytes");
    expect(partial.headers["content-range"]).toBe(`bytes 0-9/${WEBM_BYTES.length}`);
    expect(partial.rawPayload.equals(WEBM_BYTES.subarray(0, 10))).toBe(true);

    const tail = await app.inject({
      method: "GET",
      url: `/api/work-media/${video}/content`,
      headers: { range: "bytes=-4" },
    });
    expect(tail.rawPayload.equals(WEBM_BYTES.subarray(WEBM_BYTES.length - 4))).toBe(true);

    const outside = await app.inject({
      method: "GET",
      url: `/api/work-media/${video}/content`,
      headers: { range: `bytes=${WEBM_BYTES.length}-` },
    });
    expect(outside.statusCode).toBe(416);
    expect(outside.headers["content-range"]).toBe(`bytes */${WEBM_BYTES.length}`);
  });

  it("vérifie le type sur le contenu, jamais sur le nom ni l'en-tête", async () => {
    const author = await createMember("autrice");
    const disguised = await upload(author.cookie, PDF_BYTES, "video.mp4", "video/mp4");
    expect(disguised.statusCode).toBe(400);
    const renamed = await upload(author.cookie, MP4_BYTES, "image.png", "image/png");
    expect(renamed.json().media.kind).toBe("video");
    expect(renamed.json().media.mimeType).toBe("video/mp4");
  });

  it("refuse une image en vidéo, une vidéo en couverture et trop de vidéos", async () => {
    const author = await createMember("autrice");
    const image = await uploadId(author.cookie, PNG_BYTES, "image.png");
    const video = await uploadId(author.cookie, MP4_BYTES, "demo.mp4");

    expect(
      (await createWork(author.cookie, { media: [{ id: image, role: "video" }], youtubeUrls: [] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await createWork(author.cookie, { media: [{ id: video, role: "cover" }], youtubeUrls: [] }))
        .statusCode,
    ).toBe(400);
    const tooMany = await createWork(author.cookie, {
      media: [{ id: video, role: "video" }],
      youtubeUrls: [
        "https://youtu.be/dQw4w9WgXcQ",
        "https://youtu.be/aaaaaaaaaaa",
        "https://youtu.be/bbbbbbbbbbb",
      ],
    });
    expect(tooMany.statusCode).toBe(400);
    const notYoutube = await createWork(author.cookie, {
      media: [],
      youtubeUrls: ["https://example.com/watch?v=dQw4w9WgXcQ"],
    });
    expect(notYoutube.statusCode).toBe(400);
  });

  it("n'accepte que les fichiers envoyés par le publieur", async () => {
    const author = await createMember("autrice");
    const other = await createMember("autre");
    const foreign = await uploadId(other.cookie, PNG_BYTES, "image.png");
    const created = await createWork(author.cookie, {
      media: [{ id: foreign, role: "cover" }],
      youtubeUrls: [],
    });
    expect(created.statusCode).toBe(400);
    expect(
      (await app.inject({ method: "GET", url: `/api/work-media/${foreign}/content` })).statusCode,
    ).toBe(404);
  });

  it("refuse l'envoi à un visiteur et une vidéo trop lourde", async () => {
    const visitor = await upload("", MP4_BYTES, "demo.mp4");
    expect(visitor.statusCode).toBe(401);

    app = createApp({
      maxAttachmentBytes: 25 * 1024 * 1024,
      maxUserStorageBytes: 500 * 1024 * 1024,
      maxWorkVideoBytes: MP4_BYTES.length - 1,
    });
    const author = await createMember("autrice");
    expect((await upload(author.cookie, MP4_BYTES, "demo.mp4")).statusCode).toBe(400);
    expect((await upload(author.cookie, PNG_BYTES, "image.png")).statusCode).toBe(200);
  });

  it("compte les médias dans le quota commun", async () => {
    app = createApp({
      maxAttachmentBytes: 25 * 1024 * 1024,
      maxUserStorageBytes: PNG_BYTES.length + MP4_BYTES.length - 1,
    });
    const author = await createMember("autrice");
    expect((await upload(author.cookie, PNG_BYTES, "image.png")).statusCode).toBe(200);
    const over = await upload(author.cookie, MP4_BYTES, "demo.mp4");
    expect(over.statusCode).toBe(400);
  });

  it("remplace les médias à la modification et libère les anciens, effacés ensuite", async () => {
    const author = await createMember("autrice");
    const first = await uploadId(author.cookie, PNG_BYTES, "premiere.png");
    const second = await uploadId(author.cookie, PNG_BYTES, "seconde.png");
    await createWork(author.cookie, {
      media: [{ id: first, role: "cover" }],
      youtubeUrls: ["https://youtu.be/dQw4w9WgXcQ"],
    });

    const patched = await app.inject({
      method: "PATCH",
      url: "/api/works/travail-media",
      headers: { cookie: author.cookie },
      payload: { media: { media: [{ id: second, role: "cover" }], youtubeUrls: [] } },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().work.coverMediaId).toBe(second);
    expect(patched.json().work.videos).toEqual([]);
    expect(
      (await app.inject({ method: "GET", url: `/api/work-media/${first}/content` })).statusCode,
    ).toBe(404);

    // Délai de grâce d'une heure : rien ne part tout de suite.
    expect(await cleanupOrphanWorkMedia(db, storage)).toBe(0);
  });

  it("ne sert plus rien une fois le travail supprimé", async () => {
    const author = await createMember("autrice");
    const cover = await uploadId(author.cookie, PNG_BYTES, "couverture.png");
    await createWork(author.cookie, { media: [{ id: cover, role: "cover" }], youtubeUrls: [] });
    await app.inject({
      method: "DELETE",
      url: "/api/works/travail-media",
      headers: { cookie: author.cookie },
    });
    expect(
      (await app.inject({ method: "GET", url: `/api/work-media/${cover}/content` })).statusCode,
    ).toBe(404);
  });
  it("ne déplace pas un fichier d'un travail à un autre", async () => {
    const author = await createMember("autrice");
    const cover = await uploadId(author.cookie, PNG_BYTES, "couverture.png");
    await createWork(author.cookie, { media: [{ id: cover, role: "cover" }], youtubeUrls: [] });
    const second = await createWork(
      author.cookie,
      { media: [{ id: cover, role: "cover" }], youtubeUrls: [] },
      "second-travail",
    );
    expect(second.statusCode).toBe(400);
  });

  it("refuse l'envoi à un compte suspendu et la modification des médias à un coauteur", async () => {
    const suspended = await createMember("suspendu");
    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, suspended.profileId));
    expect((await upload(suspended.cookie, PNG_BYTES, "image.png")).statusCode).toBe(403);

    const author = await createMember("autrice");
    const coauthor = await createMember("coautrice");
    await createWork(author.cookie);
    await app.inject({
      method: "POST",
      url: "/api/works/travail-media/authors",
      headers: { cookie: author.cookie },
      payload: { handle: "coautrice" },
    });
    await app.inject({
      method: "PUT",
      url: "/api/works/travail-media/invitation",
      headers: { cookie: coauthor.cookie },
      payload: { accepted: true },
    });
    const image = await uploadId(coauthor.cookie, PNG_BYTES, "image.png");
    const patched = await app.inject({
      method: "PATCH",
      url: "/api/works/travail-media",
      headers: { cookie: coauthor.cookie },
      payload: { media: { media: [{ id: image, role: "cover" }], youtubeUrls: [] } },
    });
    expect(patched.statusCode).toBe(403);
  });

  it("efface les médias avec le compte de leur auteur", async () => {
    const author = await createMember("autrice");
    const cover = await uploadId(author.cookie, PNG_BYTES, "couverture.png");
    const video = await uploadId(author.cookie, MP4_BYTES, "demo.mp4");
    await createWork(author.cookie, {
      media: [
        { id: cover, role: "cover" },
        { id: video, role: "video" },
      ],
      youtubeUrls: ["https://youtu.be/dQw4w9WgXcQ"],
    });
    const deletion = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: author.cookie },
      payload: { password: "une-passphrase-solide" },
    });
    expect(deletion.statusCode).toBe(204);
    for (const id of [cover, video]) {
      expect(
        (await app.inject({ method: "GET", url: `/api/work-media/${id}/content` })).statusCode,
      ).toBe(404);
    }
  });
});
