import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, spaces } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { readFileSync } from "node:fs";
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

const VOICE_WEBM = readFileSync(new URL("../storage/fixtures/voice.webm", import.meta.url));

function buildVoiceBody(durationMs: string | null, data: Buffer, boundary: string): Buffer {
  const field =
    durationMs === null
      ? ""
      : `--${boundary}\r\nContent-Disposition: form-data; name="durationMs"\r\n\r\n${durationMs}\r\n`;
  return Buffer.concat([
    Buffer.from(
      `${field}--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voix.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

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

  async function uploadVoice(cookie: string, channelId: string, durationMs: string | null, data: Buffer) {
    const boundary = "----kemetvoiceboundary";
    return app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages/voice`,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: buildVoiceBody(durationMs, data, boundary),
    });
  }

  it("accepte un message vocal enregistré par le navigateur, gardé tel quel et servi par plages", async () => {
    const owner = await createMember("voice1@test.kemet", "Owner", "voice1");
    const { channel } = await createSpaceWithGeneralChannel(owner, "vocal");

    const uploaded = await uploadVoice(owner, channel.id, "4200", VOICE_WEBM);
    expect(uploaded.statusCode).toBe(200);
    const attachment = uploaded.json().attachment as { id: string; kind: string; mimeType: string; durationMs: number };
    expect(attachment).toMatchObject({ kind: "voice", mimeType: "audio/webm", durationMs: 4200 });

    const sent = await app.inject({
      method: "POST",
      url: `/api/channels/${channel.id}/messages`,
      headers: { cookie: owner },
      payload: { clientId: crypto.randomUUID(), body: "", attachmentIds: [attachment.id] },
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.json().message.attachments[0].kind).toBe("voice");

    const whole = await app.inject({ method: "GET", url: `/api/attachments/${attachment.id}/content`, headers: { cookie: owner } });
    expect(whole.statusCode).toBe(200);
    expect(whole.headers["accept-ranges"]).toBe("bytes");
    expect(whole.headers["content-type"]).toBe("audio/webm");
    expect(whole.headers["content-disposition"]).toContain("inline");
    expect(whole.headers["x-content-type-options"]).toBe("nosniff");
    expect(whole.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(whole.headers["cache-control"]).toBe("private, max-age=604800");
    expect(whole.rawPayload.equals(VOICE_WEBM)).toBe(true);

    const part = await app.inject({
      method: "GET",
      url: `/api/attachments/${attachment.id}/content`,
      headers: { cookie: owner, range: "bytes=0-99" },
    });
    expect(part.statusCode).toBe(206);
    expect(part.headers["content-range"]).toBe(`bytes 0-99/${VOICE_WEBM.length}`);
    expect(part.rawPayload.equals(VOICE_WEBM.subarray(0, 100))).toBe(true);

    const outside = await app.inject({
      method: "GET",
      url: `/api/attachments/${attachment.id}/content`,
      headers: { cookie: owner, range: `bytes=${VOICE_WEBM.length}-` },
    });
    expect(outside.statusCode).toBe(416);
    expect(outside.headers["cache-control"]).toBe("no-store");
  });

  it("refuse un message vocal sans durée valide ou de plus de deux minutes", async () => {
    const owner = await createMember("voice2@test.kemet", "Owner", "voice2");
    const { channel } = await createSpaceWithGeneralChannel(owner, "vocal2");

    expect((await uploadVoice(owner, channel.id, null, VOICE_WEBM)).statusCode).toBe(400);
    expect((await uploadVoice(owner, channel.id, "abc", VOICE_WEBM)).statusCode).toBe(400);
    expect((await uploadVoice(owner, channel.id, "120001", VOICE_WEBM)).statusCode).toBe(400);
  });

  it("refuse comme message vocal un fichier qui n'est pas de l'audio", async () => {
    const owner = await createMember("voice3@test.kemet", "Owner", "voice3");
    const { channel } = await createSpaceWithGeneralChannel(owner, "vocal3");

    const response = await uploadVoice(owner, channel.id, "1000", PNG_BYTES);
    expect(response.statusCode).toBe(400);
  });

  it("refuse un message vocal à qui ne peut pas écrire dans le salon", async () => {
    const owner = await createMember("voice4@test.kemet", "Owner", "voice4");
    const outsider = await createMember("voice5@test.kemet", "Outsider", "voice5");
    const { channel } = await createSpaceWithGeneralChannel(owner, "vocal4", "private");

    const response = await uploadVoice(outsider, channel.id, "1000", VOICE_WEBM);
    expect([403, 404]).toContain(response.statusCode);
    const anonymous = await app.inject({ method: "POST", url: `/api/channels/${channel.id}/messages/voice` });
    expect(anonymous.statusCode).toBe(401);
  });

  it("compte un message vocal dans le quota de stockage de l'utilisateur", async () => {
    app = await createApp({ maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: VOICE_WEBM.length })();
    const owner = await createMember("voice6@test.kemet", "Owner", "voice6");
    const { channel } = await createSpaceWithGeneralChannel(owner, "vocal5");

    expect((await uploadVoice(owner, channel.id, "1000", VOICE_WEBM)).statusCode).toBe(200);
    expect((await uploadVoice(owner, channel.id, "1000", VOICE_WEBM)).statusCode).toBe(400);
  });

  describe("droits d'écriture d'un message vocal", () => {
    const db = createDb(databaseUrl!);

    async function openConversation(cookie: string, handle: string) {
      const response = await app.inject({
        method: "POST",
        url: "/api/conversations",
        headers: { cookie },
        payload: { handles: [handle] },
      });
      return response.json().conversation as { id: string; channelId: string };
    }

    async function sendText(cookie: string, channelId: string) {
      return app.inject({
        method: "POST",
        url: `/api/channels/${channelId}/messages`,
        headers: { cookie },
        payload: { clientId: crypto.randomUUID(), body: "Bonjour" },
      });
    }

    it("refuse un compte suspendu", async () => {
      const owner = await createMember("voice7@test.kemet", "Owner", "voice7");
      const { channel } = await createSpaceWithGeneralChannel(owner, "vocal7");
      await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.handle, "voice7"));

      expect((await uploadVoice(owner, channel.id, "1000", VOICE_WEBM)).statusCode).toBe(403);
    });

    it("refuse un espace archivé", async () => {
      const owner = await createMember("voice8@test.kemet", "Owner", "voice8");
      const { space, channel } = await createSpaceWithGeneralChannel(owner, "vocal8");
      await db.update(spaces).set({ archivedAt: new Date() }).where(eq(spaces.id, space.id));

      expect((await uploadVoice(owner, channel.id, "1000", VOICE_WEBM)).statusCode).toBe(403);
    });

    it("refuse un second envoi tant qu'une demande de conversation est en attente", async () => {
      const awa = await createMember("voice9@test.kemet", "Awa", "voice9");
      await createMember("voice10@test.kemet", "Binta", "voice10");
      const conversation = await openConversation(awa, "voice10");

      expect((await sendText(awa, conversation.channelId)).statusCode).toBe(200);
      expect((await uploadVoice(awa, conversation.channelId, "1000", VOICE_WEBM)).statusCode).toBe(403);
    });

    it("refuse un envoi à qui a bloqué l'auteur, et à un membre parti", async () => {
      const awa = await createMember("voice11@test.kemet", "Awa", "voice11");
      const binta = await createMember("voice12@test.kemet", "Binta", "voice12");
      const conversation = await openConversation(awa, "voice12");
      await app.inject({ method: "POST", url: `/api/conversations/${conversation.id}/accept`, headers: { cookie: binta } });
      expect((await uploadVoice(awa, conversation.channelId, "1000", VOICE_WEBM)).statusCode).toBe(200);

      await app.inject({ method: "PUT", url: "/api/users/voice11/block", headers: { cookie: binta } });
      expect((await uploadVoice(awa, conversation.channelId, "1000", VOICE_WEBM)).statusCode).toBe(403);

      await app.inject({ method: "POST", url: `/api/conversations/${conversation.id}/leave`, headers: { cookie: binta } });
      expect([403, 404]).toContain((await uploadVoice(binta, conversation.channelId, "1000", VOICE_WEBM)).statusCode);
    });

    it("ne rattache pas un vocal envoyé dans un salon à un message d'un autre salon", async () => {
      const owner = await createMember("voice13@test.kemet", "Owner", "voice13");
      const first = await createSpaceWithGeneralChannel(owner, "vocal13a");
      const second = await createSpaceWithGeneralChannel(owner, "vocal13b");
      const uploaded = (await uploadVoice(owner, first.channel.id, "1000", VOICE_WEBM)).json().attachment as { id: string };

      const sent = await app.inject({
        method: "POST",
        url: `/api/channels/${second.channel.id}/messages`,
        headers: { cookie: owner },
        payload: { clientId: crypto.randomUUID(), body: "", attachmentIds: [uploaded.id] },
      });
      expect(sent.statusCode).toBe(400);
    });

    it("refuse un enregistrement de plus de 4 Mio, et l'audio par la route des fichiers", async () => {
      const owner = await createMember("voice14@test.kemet", "Owner", "voice14");
      const { channel } = await createSpaceWithGeneralChannel(owner, "vocal14");
      const oversized = Buffer.concat([VOICE_WEBM, Buffer.alloc(4 * 1024 * 1024)]);

      expect((await uploadVoice(owner, channel.id, "1000", oversized)).statusCode).toBe(400);
      expect((await uploadAttachment(owner, channel.id, "voix.webm", "audio/webm", VOICE_WEBM)).statusCode).toBe(400);
    });

    it("cache un vocal d'un salon privé à qui n'en est pas membre", async () => {
      const owner = await createMember("voice15@test.kemet", "Owner", "voice15");
      const outsider = await createMember("voice16@test.kemet", "Outsider", "voice16");
      const { channel } = await createSpaceWithGeneralChannel(owner, "vocal15", "private");
      const uploaded = (await uploadVoice(owner, channel.id, "1000", VOICE_WEBM)).json().attachment as { id: string };
      await app.inject({
        method: "POST",
        url: `/api/channels/${channel.id}/messages`,
        headers: { cookie: owner },
        payload: { clientId: crypto.randomUUID(), body: "", attachmentIds: [uploaded.id] },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/attachments/${uploaded.id}/content`,
        headers: { cookie: outsider },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
