import { readFileSync } from "node:fs";
import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, postAttachments, type Db } from "@kemet/db";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { cleanupOrphanPostAttachments } from "../feed/post-attachments-cleanup.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
const PDF_BYTES = Buffer.from("%PDF-1.4\n%%EOF");
const fixture = (name: string) =>
  readFileSync(new URL(`../storage/fixtures/${name}`, import.meta.url));
const CLIP_WEBM = fixture("clip.webm");
const CLIP_MP4 = fixture("clip.mp4");
const VOICE_WEBM = fixture("voice.webm");

function box(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, "latin1");
  return Buffer.concat([header, body]);
}

/** MP4 qui annonce 61 secondes dans mvhd, avec une piste vidéo. */
function longMp4(): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(61_000, 16);
  const hdlr = Buffer.alloc(24);
  hdlr.write("vide", 8, "latin1");
  return Buffer.concat([
    box("ftyp", Buffer.from("isom\0\0\0\0isomiso2", "latin1")),
    box("moov", Buffer.concat([box("mvhd", mvhd), box("trak", box("mdia", box("hdlr", hdlr)))])),
  ]);
}

interface Part {
  name: string;
  filename: string;
  type: string;
  data: Buffer;
}

function multipart(parts: Part[], boundary: string): Buffer {
  return Buffer.concat([
    ...parts.flatMap((part) => [
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: ${part.type}\r\n\r\n`,
      ),
      part.data,
      Buffer.from("\r\n"),
    ]),
    Buffer.from(`--${boundary}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Vidéos sur les posts (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let db: Db;
  let storage: InMemoryStorage;

  async function createApp(maxUserStorageBytes = 500 * 1024 * 1024) {
    db = createDb(databaseUrl!);
    storage = new InMemoryStorage();
    emailSender = new InMemoryEmailSender();
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
      attachmentLimits: { maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes },
    });
  }

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    app = await createApp();
  });

  async function createMember(email: string, handle: string): Promise<string> {
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
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return cookie;
  }

  async function uploadVideo(
    cookie: string,
    video: Buffer | null,
    poster: Buffer | null = PNG_BYTES,
  ) {
    const boundary = "----kemetvideoboundary";
    const parts: Part[] = [
      ...(poster
        ? [{ name: "poster", filename: "apercu.png", type: "image/png", data: poster }]
        : []),
      ...(video ? [{ name: "video", filename: "clip.webm", type: "video/webm", data: video }] : []),
    ];
    return app.inject({
      method: "POST",
      url: "/api/posts/videos",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(parts, boundary),
    });
  }

  async function uploadImage(cookie: string) {
    const boundary = "----kemetimageboundary";
    return app.inject({
      method: "POST",
      url: "/api/posts/attachments",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(
        [{ name: "file", filename: "photo.png", type: "image/png", data: PNG_BYTES }],
        boundary,
      ),
    });
  }

  async function publish(cookie: string, attachmentIds: string[]) {
    return app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: { body: "Ma vidéo", attachmentIds },
    });
  }

  it("accepte un WebM et un MP4 avec leur aperçu, et lit leur durée", async () => {
    const owner = await createMember("video@test.kemet", "video");
    for (const clip of [CLIP_WEBM, CLIP_MP4]) {
      const uploaded = await uploadVideo(owner, clip);
      expect(uploaded.statusCode, uploaded.body).toBe(200);
      const attachment = uploaded.json().attachment;
      expect(attachment.kind).toBe("video");
      expect(attachment.durationMs).toBeGreaterThan(1000);
      expect(attachment.durationMs).toBeLessThan(2000);
      expect([attachment.width, attachment.height]).toEqual([1, 1]);
    }
  });

  it("refuse un envoi sans session", async () => {
    const response = await app.inject({ method: "POST", url: "/api/posts/videos" });
    expect(response.statusCode).toBe(401);
  });

  it("refuse une vidéo de plus de 20 Mo", async () => {
    const owner = await createMember("big@test.kemet", "bigvideo");
    const big = Buffer.concat([CLIP_WEBM, Buffer.alloc(20 * 1024 * 1024)]);
    const response = await uploadVideo(owner, big);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain("20 Mo");
  });

  it("refuse un fichier qui n'est pas une vidéo, même nommé .webm", async () => {
    const owner = await createMember("type@test.kemet", "typevideo");
    expect((await uploadVideo(owner, PDF_BYTES)).statusCode).toBe(400);
    expect((await uploadVideo(owner, PNG_BYTES)).statusCode).toBe(400);
    const sound = await uploadVideo(owner, VOICE_WEBM);
    expect(sound.statusCode).toBe(400);
  });

  it("refuse une vidéo de plus de 60 secondes", async () => {
    const owner = await createMember("long@test.kemet", "longvideo");
    const response = await uploadVideo(owner, longMp4());
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain("60 secondes");
  });

  it("exige une image d'aperçu valide", async () => {
    const owner = await createMember("poster@test.kemet", "postervideo");
    expect((await uploadVideo(owner, CLIP_WEBM, null)).statusCode).toBe(400);
    expect((await uploadVideo(owner, CLIP_WEBM, PDF_BYTES)).statusCode).toBe(400);
    expect((await uploadVideo(owner, CLIP_WEBM, CLIP_WEBM)).statusCode).toBe(400);
  });

  it("compte la vidéo et son aperçu dans le quota de stockage", async () => {
    app = await createApp(CLIP_WEBM.length + 10);
    const owner = await createMember("quota@test.kemet", "quotavideo");
    const response = await uploadVideo(owner, CLIP_WEBM);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain("Quota");
  });

  it("publie la vidéo seule, la sert par plages et sert son aperçu", async () => {
    const owner = await createMember("serve@test.kemet", "servevideo");
    const videoId = (await uploadVideo(owner, CLIP_WEBM)).json().attachment.id as string;
    const imageId = (await uploadImage(owner)).json().attachment.id as string;
    expect((await publish(owner, [videoId, imageId])).statusCode).toBe(400);

    const notYet = await app.inject({
      method: "GET",
      url: `/api/post-attachments/${videoId}/content`,
    });
    expect(notYet.statusCode).toBe(404);

    const created = await publish(owner, [videoId]);
    expect(created.statusCode).toBe(200);
    expect(created.json().post.attachments[0]).toMatchObject({
      id: videoId,
      kind: "video",
      mimeType: "video/webm",
    });

    const url = `/api/post-attachments/${videoId}/content`;
    const full = await app.inject({ method: "GET", url });
    expect(full.statusCode).toBe(200);
    expect(full.headers["accept-ranges"]).toBe("bytes");
    expect(full.headers["content-type"]).toBe("video/webm");
    expect(full.rawPayload.equals(CLIP_WEBM)).toBe(true);

    const part = await app.inject({ method: "GET", url, headers: { range: "bytes=100-199" } });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 100-199/${CLIP_WEBM.length}`);
    expect(part.rawPayload.equals(CLIP_WEBM.subarray(100, 200))).toBe(true);

    // Lecture coupée puis reprise : le navigateur redemande la suite.
    const resumed = await app.inject({
      method: "GET",
      url,
      headers: { range: `bytes=${CLIP_WEBM.length - 50}-` },
    });
    expect(resumed.statusCode).toBe(206);
    expect(resumed.rawPayload.equals(CLIP_WEBM.subarray(CLIP_WEBM.length - 50))).toBe(true);

    const outside = await app.inject({
      method: "GET",
      url,
      headers: { range: `bytes=${CLIP_WEBM.length + 10}-` },
    });
    expect(outside.statusCode).toBe(416);

    const poster = await app.inject({
      method: "GET",
      url: `/api/post-attachments/${videoId}/poster`,
    });
    expect(poster.statusCode).toBe(200);
    expect(poster.headers["content-type"]).toBe("image/png");
    expect(poster.headers["x-content-type-options"]).toBe("nosniff");
    expect(poster.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(poster.rawPayload.equals(PNG_BYTES)).toBe(true);

    const imagePoster = await app.inject({
      method: "GET",
      url: `/api/post-attachments/${imageId}/poster`,
    });
    expect(imagePoster.statusCode).toBe(404);
  });

  async function storedKeys(attachmentId: string) {
    const [row] = await db
      .select()
      .from(postAttachments)
      .where(eq(postAttachments.id, attachmentId));
    return [row!.storageKey, row!.posterStorageKey!];
  }

  function isStored(key: string): boolean {
    try {
      storage.read(key);
      return true;
    } catch {
      return false;
    }
  }

  const posterUrl = (id: string) => `/api/post-attachments/${id}/poster`;

  it("ne sert l'aperçu ni avant la publication, ni après la suppression du post", async () => {
    const owner = await createMember("posterlife@test.kemet", "posterlife");
    const videoId = (await uploadVideo(owner, CLIP_WEBM)).json().attachment.id as string;
    expect((await app.inject({ method: "GET", url: posterUrl(videoId) })).statusCode).toBe(404);

    const postId = (await publish(owner, [videoId])).json().post.id as string;
    expect((await app.inject({ method: "GET", url: posterUrl(videoId) })).statusCode).toBe(200);

    await app.inject({ method: "DELETE", url: `/api/posts/${postId}`, headers: { cookie: owner } });
    expect((await app.inject({ method: "GET", url: posterUrl(videoId) })).statusCode).toBe(404);
  });

  it("efface la vidéo et son aperçu avec le compte de l'auteur", async () => {
    const owner = await createMember("posterdel@test.kemet", "posterdel");
    const videoId = (await uploadVideo(owner, CLIP_WEBM)).json().attachment.id as string;
    await publish(owner, [videoId]);
    const keys = await storedKeys(videoId);
    expect(keys.every(isStored)).toBe(true);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: owner },
      payload: { password: "une-passphrase-solide" },
    });
    expect(deleted.statusCode, deleted.body).toBeLessThan(300);
    expect(keys.some(isStored)).toBe(false);
    expect((await app.inject({ method: "GET", url: posterUrl(videoId) })).statusCode).toBe(404);
  });

  it("efface une vidéo jamais publiée et son aperçu au nettoyage des orphelins", async () => {
    const owner = await createMember("posterorphan@test.kemet", "posterorphan");
    const videoId = (await uploadVideo(owner, CLIP_WEBM)).json().attachment.id as string;
    const keys = await storedKeys(videoId);
    await db
      .update(postAttachments)
      .set({ createdAt: sql`now() - interval '2 hours'` })
      .where(eq(postAttachments.id, videoId));
    expect(await cleanupOrphanPostAttachments(db, storage)).toBe(1);
    expect(keys.some(isStored)).toBe(false);
  });

  it("refuse un aperçu de plus de 1 Mo, un champ en double et un identifiant mal formé", async () => {
    const owner = await createMember("posterlimits@test.kemet", "posterlimits");
    const heavy = Buffer.concat([PNG_BYTES, Buffer.alloc(1024 * 1024)]);
    const tooHeavy = await uploadVideo(owner, CLIP_WEBM, heavy);
    expect(tooHeavy.statusCode).toBe(400);
    expect(tooHeavy.json().error.message).toContain("aperçu");

    const boundary = "----kemetdoubleboundary";
    const twice = await app.inject({
      method: "POST",
      url: "/api/posts/videos",
      headers: { cookie: owner, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(
        [
          { name: "video", filename: "a.webm", type: "video/webm", data: CLIP_WEBM },
          { name: "video", filename: "b.webm", type: "video/webm", data: CLIP_WEBM },
        ],
        boundary,
      ),
    });
    expect(twice.statusCode).toBe(400);

    expect((await app.inject({ method: "GET", url: posterUrl("abc") })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: "GET", url: "/api/post-attachments/abc/content" })).statusCode,
    ).toBe(400);
  });

  it("garde le fichier compté quand une image annonce des dimensions démesurées", async () => {
    const owner = await createMember("hugepng@test.kemet", "hugepng");
    // Vrai PNG 1x1 dont l'en-tête IHDR annonce 2^31 pixels de large.
    const huge = Buffer.from(PNG_BYTES);
    huge.writeUInt32BE(0x80000000, 16);
    const boundary = "----kemethugeboundary";
    const response = await app.inject({
      method: "POST",
      url: "/api/posts/attachments",
      headers: { cookie: owner, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: multipart(
        [{ name: "file", filename: "huge.png", type: "image/png", data: huge }],
        boundary,
      ),
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().attachment).toMatchObject({ width: null, height: null });
  });
});
