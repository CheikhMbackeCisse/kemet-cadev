import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, type Db } from "@kemet/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const BOUNDARY = "----kemetcacheboundary";

function multipart(filename: string, contentType: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

// Aucun cache partagé ne doit pouvoir garder une réponse réservée à un compte.
function expectPrivate(response: { headers: Record<string, unknown>; statusCode: number }, what: string) {
  expect(response.statusCode, what).toBeLessThan(400);
  const header = String(response.headers["cache-control"] ?? "");
  expect(header, what).toMatch(/\b(private|no-store)\b/);
  expect(header, what).not.toMatch(/\bpublic\b/);
}

interface Member {
  cookie: string;
  handle: string;
}

describe.skipIf(!databaseUrl)("Cache des réponses privées (base Postgres réelle)", () => {
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
    app = buildApp({
      db,
      auth,
      chat: createNoopChatPublisher(),
      storage: new InMemoryStorage(),
      attachmentLimits: { maxAttachmentBytes: 25 * 1024 * 1024, maxUserStorageBytes: 500 * 1024 * 1024 },
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 3 },
    });
  });

  afterEach(async () => {
    await app.close();
    await db.$client.end();
  });

  async function createMember(handle: string): Promise<Member> {
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
    await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, handle };
  }

  function upload(cookie: string, url: string, filename: string, type: string, data: Buffer) {
    return app.inject({
      method: "POST",
      url,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
      payload: multipart(filename, type, data),
    });
  }

  async function sendWithImage(member: Member, channelId: string) {
    const attachment = (await upload(member.cookie, `/api/channels/${channelId}/messages/attachments`, "a.png", "image/png", PNG_BYTES)).json()
      .attachment as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie: member.cookie },
      payload: { clientId: crypto.randomUUID(), body: "Voici le fichier", attachmentIds: [attachment.id] },
    });
    return attachment.id;
  }

  it("ne laisse aucune réponse de la messagerie privée en cache partagé", async () => {
    const awa = await createMember("awa");
    const binta = await createMember("binta");
    const conversation = (
      await app.inject({ method: "POST", url: "/api/conversations", headers: { cookie: awa.cookie }, payload: { handles: ["binta"] } })
    ).json().conversation as { id: string; channelId: string };
    const attachmentId = await sendWithImage(awa, conversation.channelId);
    const asBinta = { cookie: binta.cookie };

    expectPrivate(await app.inject({ method: "GET", url: "/api/conversations?box=requests", headers: asBinta }), "liste");
    expectPrivate(await app.inject({ method: "GET", url: "/api/conversations/unread", headers: asBinta }), "non-lus");
    expectPrivate(await app.inject({ method: "GET", url: `/api/conversations/${conversation.id}`, headers: asBinta }), "conversation");
    expectPrivate(
      await app.inject({ method: "GET", url: `/api/channels/${conversation.channelId}/messages`, headers: asBinta }),
      "messages",
    );
    expectPrivate(await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: asBinta }), "fichier");
  });

  it("ne laisse aucune réponse d'un espace privé en cache partagé", async () => {
    const owner = await createMember("owner");
    const space = (
      await app.inject({
        method: "POST",
        url: "/api/spaces",
        headers: { cookie: owner.cookie },
        payload: { name: "secret", slug: "secret", visibility: "private" },
      })
    ).json().space as { id: string };
    const channels = (await app.inject({ method: "GET", url: `/api/spaces/${space.id}/channels`, headers: { cookie: owner.cookie } })).json()
      .items as { id: string; slug: string }[];
    const channelId = channels.find((channel) => channel.slug === "general")!.id;
    const attachmentId = await sendWithImage(owner, channelId);
    const asOwner = { cookie: owner.cookie };

    expectPrivate(await app.inject({ method: "GET", url: "/api/spaces", headers: asOwner }), "espaces");
    expectPrivate(await app.inject({ method: "GET", url: `/api/spaces/${space.id}`, headers: asOwner }), "espace");
    expectPrivate(await app.inject({ method: "GET", url: `/api/spaces/${space.id}/channels`, headers: asOwner }), "salons");
    expectPrivate(await app.inject({ method: "GET", url: `/api/spaces/${space.id}/members`, headers: asOwner }), "membres");
    expectPrivate(await app.inject({ method: "GET", url: `/api/channels/${channelId}/messages`, headers: asOwner }), "messages");
    expectPrivate(await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: asOwner }), "fichier");
  });

  it("ne laisse ni les candidatures d'un projet ni un CV réservé aux comptes connectés en cache partagé", async () => {
    const owner = await createMember("porteur");
    const applicant = await createMember("candidate");
    await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie: owner.cookie },
      payload: {
        slug: "projet-cache",
        name: "Projet cache",
        pitch: "Un projet créé pour vérifier le cache des réponses.",
        repoUrl: "https://github.com/exemple/projet-cache",
      },
    });
    const helpRequest = (
      await app.inject({
        method: "POST",
        url: "/api/projects/projet-cache/help-requests",
        headers: { cookie: owner.cookie },
        payload: { title: "Cherche un dev", description: "Besoin d'un coup de main sur l'API." },
      })
    ).json().helpRequest as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequest.id}/applications`,
      headers: { cookie: applicant.cookie },
      payload: { message: "Je peux aider sur ce point rapidement." },
    });
    expectPrivate(
      await app.inject({ method: "GET", url: `/api/help-requests/${helpRequest.id}/applications`, headers: { cookie: owner.cookie } }),
      "candidatures",
    );

    expect((await upload(owner.cookie, "/api/me/cv", "cv.pdf", "application/pdf", PDF_BYTES)).statusCode).toBe(200);
    expectPrivate(
      await app.inject({ method: "GET", url: "/api/users/porteur/cv/content", headers: { cookie: applicant.cookie } }),
      "CV",
    );
    expectPrivate(await app.inject({ method: "GET", url: "/api/me", headers: { cookie: owner.cookie } }), "compte");
  });
});
