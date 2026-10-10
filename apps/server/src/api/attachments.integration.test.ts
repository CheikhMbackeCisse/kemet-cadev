import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

// PNG 1x1 valide (signature + chunks IHDR/IDAT/IEND réels) : file-type exige
// une structure de chunks correcte, pas seulement la signature, pour
// distinguer un vrai PNG d'un fichier tronqué ou corrompu.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
const SVG_BYTES = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');

function buildMultipartBody(filename: string, contentType: string, data: Buffer, boundary: string): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Fichiers et images dans les messages (base Postgres réelle)", () => {
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
        chat: createNoopChatPublisher(),
        storage: new InMemoryStorage(),
        attachmentLimits: attachmentLimits ?? { maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: 500 * 1024 * 1024 },
      });
    };
  }

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
    app = await createApp()();
  });

  function extractVerificationUrl(email: string): string {
    const [message] = emailSender.findByRecipient(email);
    const match = message?.html.match(/href="([^"]+)"/);
    if (!match) throw new Error("Email de vérification introuvable.");
    return match[1]!;
  }

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function createMember(email: string, name: string, handle: string): Promise<string> {
    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: "une-passphrase-solide", name },
    });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email, password: "une-passphrase-solide" },
    });
    const cookie = extractCookie(signIn);
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: name, country: "SN" },
    });
    return cookie;
  }

  async function createSpaceWithGeneralChannel(cookie: string, slug: string, visibility: "public" | "private" = "public") {
    const space = (
      await app.inject({ method: "POST", url: "/api/spaces", headers: { cookie }, payload: { name: slug, slug, visibility } })
    ).json().space as { id: string };
    const channels = (
      await app.inject({ method: "GET", url: `/api/spaces/${space.id}/channels`, headers: { cookie } })
    ).json().items as { id: string; slug: string }[];
    return { space, channel: channels.find((c) => c.slug === "general")! };
  }

  async function uploadAttachment(cookie: string, channelId: string, filename: string, contentType: string, data: Buffer) {
    const boundary = "----kemettestboundary";
    return app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages/attachments`,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildMultipartBody(filename, contentType, data, boundary),
    });
  }

  it("détecte le vrai type d'un fichier par son contenu et refuse une extension trompeuse sans signature reconnue", async () => {
    const owner = await createMember("owner@test.kemet", "Owner", "owner");
    const { channel } = await createSpaceWithGeneralChannel(owner, "fichiers");

    const fake = await uploadAttachment(owner, channel.id, "photo.png", "image/png", Buffer.from("pas une vraie image"));
    expect(fake.statusCode).toBe(400);

    const real = await uploadAttachment(owner, channel.id, "photo.exe", "application/octet-stream", PNG_BYTES);
    expect(real.statusCode).toBe(200);
    expect(real.json().attachment.kind).toBe("image");
    expect(real.json().attachment.mimeType).toBe("image/png");
  });

  it("rattache un fichier envoyé à un message et le sert en ligne pour un membre de l'espace", async () => {
    const owner = await createMember("owner2@test.kemet", "Owner", "owner2");
    const { channel } = await createSpaceWithGeneralChannel(owner, "fichiers2");

    const uploaded = await uploadAttachment(owner, channel.id, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;

    const sent = await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "Une image", attachmentIds: [attachmentId] },
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.json().message.attachments).toHaveLength(1);

    const served = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: owner } });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-disposition"]).toContain("inline");
    expect(served.rawPayload.equals(PNG_BYTES)).toBe(true);
  });

  it("ne sert jamais un SVG en ligne, même accepté en téléchargement", async () => {
    const owner = await createMember("owner3@test.kemet", "Owner", "owner3");
    const { channel } = await createSpaceWithGeneralChannel(owner, "fichiers3");

    const uploaded = await uploadAttachment(owner, channel.id, "logo.svg", "image/svg+xml", SVG_BYTES);
    expect(uploaded.statusCode).toBe(200);
    const attachmentId = uploaded.json().attachment.id as string;

    const sent = await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "Un logo", attachmentIds: [attachmentId] },
    });
    expect(sent.statusCode).toBe(200);

    const served = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: owner } });
    expect(served.headers["content-disposition"]).toContain("attachment");
  });

  it("cache un fichier d'un salon privé à qui n'en est pas membre", async () => {
    const owner = await createMember("owner4@test.kemet", "Owner", "owner4");
    const outsider = await createMember("outsider@test.kemet", "Outsider", "outsider");
    const { channel } = await createSpaceWithGeneralChannel(owner, "prive", "private");

    const uploaded = await uploadAttachment(owner, channel.id, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;
    await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "Une image", attachmentIds: [attachmentId] },
    });

    const served = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: outsider } });
    expect(served.statusCode).toBe(404);
  });

  it("cache le fichier d'un message supprimé, même pour un membre du salon", async () => {
    const owner = await createMember("owner4b@test.kemet", "Owner", "owner4b");
    const { channel } = await createSpaceWithGeneralChannel(owner, "supprime");

    const uploaded = await uploadAttachment(owner, channel.id, "photo.png", "image/png", PNG_BYTES);
    const attachmentId = uploaded.json().attachment.id as string;
    const sent = await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "Une image", attachmentIds: [attachmentId] },
    });
    const messageId = sent.json().message.id as string;

    await app.inject({ method: "DELETE", url: `/api/messages/${messageId}`, headers: { cookie: owner } });

    const served = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: owner } });
    expect(served.statusCode).toBe(404);
  });

  it("refuse deux envois concurrents qui dépasseraient ensemble le quota de l'utilisateur", async () => {
    app = await createApp({ maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: PNG_BYTES.length + 4 })();
    const owner = await createMember("owner6b@test.kemet", "Owner", "owner6b");
    const { channel } = await createSpaceWithGeneralChannel(owner, "quota-concurrent");

    const [first, second] = await Promise.all([
      uploadAttachment(owner, channel.id, "a.png", "image/png", PNG_BYTES),
      uploadAttachment(owner, channel.id, "b.png", "image/png", PNG_BYTES),
    ]);
    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 400]);
  });

  it("refuse un fichier qui dépasse la taille maximale autorisée", async () => {
    app = await createApp({ maxAttachmentBytes: 8, maxUserStorageBytes: 500 * 1024 * 1024 })();
    const owner = await createMember("owner5@test.kemet", "Owner", "owner5");
    const { channel } = await createSpaceWithGeneralChannel(owner, "trop-gros");

    const response = await uploadAttachment(owner, channel.id, "photo.png", "image/png", PNG_BYTES);
    expect(response.statusCode).toBe(400);
  });

  it("refuse un envoi qui dépasse le quota de stockage de l'utilisateur", async () => {
    app = await createApp({ maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: PNG_BYTES.length })();
    const owner = await createMember("owner6@test.kemet", "Owner", "owner6");
    const { channel } = await createSpaceWithGeneralChannel(owner, "quota");

    const first = await uploadAttachment(owner, channel.id, "a.png", "image/png", PNG_BYTES);
    expect(first.statusCode).toBe(200);

    const second = await uploadAttachment(owner, channel.id, "b.png", "image/png", PNG_BYTES);
    expect(second.statusCode).toBe(400);
  });
});
