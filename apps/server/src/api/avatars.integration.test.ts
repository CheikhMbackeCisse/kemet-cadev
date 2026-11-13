import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profileAvatars, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const PASSWORD = "une-passphrase-solide";
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
// En-tête PNG qui annonce 5000 x 5000 pixels : jamais décodée par le serveur.
const HUGE_PNG = Buffer.from(PNG_BYTES);
HUGE_PNG.writeUInt32BE(5000, 16);
HUGE_PNG.writeUInt32BE(5000, 20);
const BOUNDARY = "----kemetavatarboundary";

function multipart(filename: string, contentType: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    data,
    Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
  ]);
}

describe.skipIf(!databaseUrl)("Photo de profil (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let storage: InMemoryStorage;

  afterEach(async () => {
    await db.$client.end();
  });

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

  async function createMember(handle: string) {
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
    return { cookie, profileId: me.json().profile.id as string };
  }

  function upload(
    cookie: string | undefined,
    data = PNG_BYTES,
    filename = "photo.png",
    type = "image/png",
  ) {
    return app.inject({
      method: "PUT",
      url: "/api/me/avatar",
      headers: {
        ...(cookie ? { cookie } : {}),
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
      },
      payload: multipart(filename, type, data),
    });
  }

  function storedKeys(profileId: string) {
    return db
      .select({ storageKey: profileAvatars.storageKey })
      .from(profileAvatars)
      .where(eq(profileAvatars.profileId, profileId));
  }

  it("pose la photo, la sert à tous et remplace l'ancienne au second envoi", async () => {
    const awa = await createMember("awa");

    const first = await upload(awa.cookie);
    expect(first.statusCode).toBe(200);
    const firstUrl = first.json().avatarUrl as string;
    expect(firstUrl).toMatch(/^\/api\/avatars\/[0-9a-f-]{36}$/);
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: awa.cookie } });
    expect(me.json().profile.avatarUrl).toBe(firstUrl);

    const served = await app.inject({ method: "GET", url: firstUrl });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
    expect(served.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(served.rawPayload.equals(PNG_BYTES)).toBe(true);

    const [firstRow] = await storedKeys(awa.profileId);
    const second = await upload(awa.cookie);
    expect(second.statusCode).toBe(200);
    expect(second.json().avatarUrl).not.toBe(firstUrl);
    expect((await app.inject({ method: "GET", url: firstUrl })).statusCode).toBe(404);
    expect(() => storage.read(firstRow!.storageKey)).toThrow();
    expect(await storedKeys(awa.profileId)).toHaveLength(1);
  });

  it("refuse ce qui n'est pas une image PNG, JPEG ou WebP, quel que soit le nom annoncé", async () => {
    const awa = await createMember("awa");
    const disguised = await upload(awa.cookie, PDF_BYTES, "photo.png", "image/png");
    expect(disguised.statusCode).toBe(400);
    const huge = await upload(awa.cookie, HUGE_PNG);
    expect(huge.statusCode).toBe(400);
    expect(await storedKeys(awa.profileId)).toHaveLength(0);
  });

  it("refuse un envoi sans session ou d'un compte suspendu, et ne touche qu'au profil de la session", async () => {
    expect((await upload(undefined)).statusCode).toBe(401);

    const awa = await createMember("awa");
    const binta = await createMember("binta");
    await upload(awa.cookie);
    const [bintaBefore] = await db.select().from(profiles).where(eq(profiles.id, binta.profileId));
    expect(bintaBefore!.avatarUrl).toBeNull();

    await db
      .update(profiles)
      .set({ suspendedAt: new Date() })
      .where(eq(profiles.id, awa.profileId));
    expect((await upload(awa.cookie)).statusCode).toBe(403);
  });

  it("ne sert rien pour une clé inconnue ou mal formée", async () => {
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/avatars/00000000-0000-4000-8000-000000000000",
        })
      ).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/avatars/..%2Fsecret" })).statusCode).toBe(
      404,
    );
  });

  it("efface la photo et son fichier avec le compte", async () => {
    const awa = await createMember("awa");
    const uploaded = await upload(awa.cookie);
    const url = uploaded.json().avatarUrl as string;
    const [row] = await storedKeys(awa.profileId);

    const deleted = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: awa.cookie },
      payload: { password: PASSWORD },
    });
    expect(deleted.statusCode).toBe(204);
    expect(await storedKeys(awa.profileId)).toHaveLength(0);
    expect(() => storage.read(row!.storageKey)).toThrow();
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
  });
});
