import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

// PNG 1x1 valide (signature + chunks IHDR/IDAT/IEND réels) : file-type exige
// une structure de chunks correcte, pas seulement la signature.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
const PDF_BYTES = Buffer.from("%PDF-1.4\n%%EOF");

function buildMultipartBody(filename: string, contentType: string, data: Buffer, boundary: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Images sur les posts (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;

  function createApp(attachmentLimits?: { maxAttachmentBytes: number; maxUserStorageBytes: number }) {
    return async () => {
      const db = createDb(databaseUrl!);
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
        storage: new InMemoryStorage(),
        attachmentLimits: attachmentLimits ?? { maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: 500 * 1024 * 1024 },
      });
    };
  }

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    app = await createApp()();
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  function extractVerificationUrl(email: string): string {
    const [message] = emailSender.findByRecipient(email);
    const match = message?.html.match(/href="([^"]+)"/);
    if (!match) throw new Error("Email de vérification introuvable.");
    return match[1]!;
  }

  async function createMember(email: string, handle: string): Promise<string> {
    await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { email, password: "une-passphrase-solide", name: handle } });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "une-passphrase-solide" } });
    const cookie = extractCookie(signIn);
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return cookie;
  }

  async function uploadPostAttachment(cookie: string, filename: string, contentType: string, data: Buffer) {
    const boundary = "----kemettestboundary";
    return app.inject({
      method: "POST",
      url: "/api/posts/attachments",
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartBody(filename, contentType, data, boundary),
    });
  }

  it("refuse un fichier qui n'est pas une image, même avec une extension trompeuse", async () => {
    const owner = await createMember("owner@test.kemet", "owner");
    const response = await uploadPostAttachment(owner, "doc.png", "image/png", PDF_BYTES);
    expect(response.statusCode).toBe(400);
  });

  it("crée un post avec des images et les sert publiquement, sans session", async () => {
    const owner = await createMember("owner2@test.kemet", "owner2");
    const uploaded = await uploadPostAttachment(owner, "photo.png", "image/png", PNG_BYTES);
    expect(uploaded.statusCode).toBe(200);
    const attachmentId = uploaded.json().attachment.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().post.attachments).toHaveLength(1);

    const served = await app.inject({ method: "GET", url: `/api/post-attachments/${attachmentId}/content` });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-disposition"]).toContain("inline");
    expect(served.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(served.rawPayload.equals(PNG_BYTES)).toBe(true);
  });

  it("refuse un post sans texte ni image", async () => {
    const owner = await createMember("owner3@test.kemet", "owner3");
    const response = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("cache l'image d'un post supprimé", async () => {
    const owner = await createMember("owner4@test.kemet", "owner4");
    const uploaded = await uploadPostAttachment(owner, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    const postId = created.json().post.id as string;

    await app.inject({ method: "DELETE", url: `/api/posts/${postId}`, headers: { cookie: owner } });

    const served = await app.inject({ method: "GET", url: `/api/post-attachments/${attachmentId}/content` });
    expect(served.statusCode).toBe(404);
  });

  it("partage un quota de stockage unique avec les fichiers de salon", async () => {
    app = await createApp({ maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: PNG_BYTES.length })();
    const owner = await createMember("owner5@test.kemet", "owner5");
    const space = (
      await app.inject({
        method: "POST",
        url: "/api/spaces",
        headers: { cookie: owner },
        payload: { name: "quota", slug: "quota", visibility: "public" },
      })
    ).json().space as { id: string };
    const channels = (
      await app.inject({ method: "GET", url: `/api/spaces/${space.id}/channels`, headers: { cookie: owner } })
    ).json().items as { id: string; slug: string }[];
    const channel = channels.find((c) => c.slug === "general")!;

    const boundary = "----kemettestboundary";
    const chatUpload = await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages/attachments`,
      headers: { cookie: owner, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartBody("a.png", "image/png", PNG_BYTES, boundary),
    });
    expect(chatUpload.statusCode).toBe(200);

    const postUpload = await uploadPostAttachment(owner, "b.png", "image/png", PNG_BYTES);
    expect(postUpload.statusCode).toBe(400);
  });

  it("refuse de réutiliser une image déjà rattachée à un autre post", async () => {
    const owner = await createMember("owner8@test.kemet", "owner8");
    const uploaded = await uploadPostAttachment(owner, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;

    const first = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    expect(second.statusCode).toBe(400);
  });

  it("garde un post composé uniquement d'images modifiable sans y ajouter de texte", async () => {
    const owner = await createMember("owner9@test.kemet", "owner9");
    const uploaded = await uploadPostAttachment(owner, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;
    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: owner },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    const postId = created.json().post.id as string;

    const edited = await app.inject({
      method: "PATCH",
      url: `/api/posts/${postId}`,
      headers: { cookie: owner },
      payload: { body: "" },
    });
    expect(edited.statusCode).toBe(200);
  });

  it("refuse de créer un post avec une image envoyée par quelqu'un d'autre", async () => {
    const owner = await createMember("owner6@test.kemet", "owner6");
    const other = await createMember("owner7@test.kemet", "owner7");
    const uploaded = await uploadPostAttachment(owner, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;

    const created = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: other },
      payload: { body: "", attachmentIds: [attachmentId] },
    });
    expect(created.statusCode).toBe(400);
  });
});
