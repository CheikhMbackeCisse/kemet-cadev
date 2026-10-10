import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Skills (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
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
    app = buildApp({ db, auth });
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
    await app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload: { handle, displayName: handle, country: "SN" } });
    return cookie;
  }

  async function createSkill(cookie: string, overrides: Partial<Record<string, unknown>> = {}) {
    const response = await app.inject({
      method: "POST",
      url: "/api/skills",
      headers: { cookie },
      payload: {
        slug: "wave-paiements",
        name: "wave-paiements",
        description: "Intégration des paiements Wave côté serveur.",
        content: "Contenu du skill.",
        tags: ["wave"],
        visibility: "public",
        ...overrides,
      },
    });
    return response;
  }

  it("rend un skill privé invisible à qui n'est pas son auteur", async () => {
    const author = await createMember("author@test.kemet", "author");
    const other = await createMember("other@test.kemet", "other");
    await createSkill(author, { visibility: "private" });

    const asAuthor = await app.inject({ method: "GET", url: "/api/skills/wave-paiements", headers: { cookie: author } });
    expect(asAuthor.statusCode).toBe(200);

    const asOther = await app.inject({ method: "GET", url: "/api/skills/wave-paiements", headers: { cookie: other } });
    expect(asOther.statusCode).toBe(404);
  });

  it("rend un skill public visible à tout le monde", async () => {
    const author = await createMember("author2@test.kemet", "author2");
    const other = await createMember("other2@test.kemet", "other2");
    await createSkill(author);

    const asOther = await app.inject({ method: "GET", url: "/api/skills/wave-paiements", headers: { cookie: other } });
    expect(asOther.statusCode).toBe(200);
  });

  it("refuse la modification ou la suppression d'un skill à qui n'en est pas l'auteur", async () => {
    const author = await createMember("author3@test.kemet", "author3");
    const other = await createMember("other3@test.kemet", "other3");
    await createSkill(author);

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/skills/wave-paiements",
      headers: { cookie: other },
      payload: { description: "une autre description suffisamment longue" },
    });
    expect(patch.statusCode).toBe(403);

    const remove = await app.inject({ method: "DELETE", url: "/api/skills/wave-paiements", headers: { cookie: other } });
    expect(remove.statusCode).toBe(403);
  });

  it("refuse de noter un skill à qui il n'a jamais servi", async () => {
    const author = await createMember("author4@test.kemet", "author4");
    const other = await createMember("other4@test.kemet", "other4");
    await createSkill(author);

    const rate = await app.inject({
      method: "PUT",
      url: "/api/skills/wave-paiements/rating",
      headers: { cookie: other },
      payload: { stars: 5 },
    });
    expect(rate.statusCode).toBe(403);
  });

  it("refuse de limiter un skill à un espace dont l'auteur n'est pas membre", async () => {
    const outsiderAuthor = await createMember("author6@test.kemet", "author6");
    const spaceOwner = await createMember("owner6@test.kemet", "owner6");
    const space = await app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: { cookie: spaceOwner },
      payload: { name: "backend", slug: "backend", visibility: "public" },
    });
    const spaceId = space.json().space.id as string;

    const response = await createSkill(outsiderAuthor, { visibility: "space", spaceId });
    expect(response.statusCode).toBe(403);
  });

  it("refuse de créer deux skills avec le même identifiant", async () => {
    const author = await createMember("author5@test.kemet", "author5");
    await createSkill(author);
    const again = await createSkill(author);
    expect(again.statusCode).toBe(409);
  });
});
