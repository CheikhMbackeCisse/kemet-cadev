import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, posts, profiles, spaceMembers, spaces, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

const SPACE_POST = "La CADEV 2026 en bref.";
const OPEN_POST = "Un post ordinaire du fil.";

describe.skipIf(!databaseUrl)(
  "Post d'espace et profil sans compte de connexion (base Postgres réelle)",
  () => {
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
      app = buildApp({ db, auth, chat: createNoopChatPublisher() });
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
      const response = await app.inject({
        method: "PATCH",
        url: "/api/me/profile",
        headers: { cookie },
        payload: { handle, displayName: handle, country: "SN" },
      });
      expect(response.statusCode).toBe(200);
      return { cookie, profileId: response.json().profile.id };
    }

    // Même forme que le profil Systalink du seed : aucune ligne `user`.
    async function createOrganization(): Promise<string> {
      const [row] = await db
        .insert(profiles)
        .values({
          userId: null,
          handle: "organisation-test",
          displayName: "Organisation",
          country: "",
          isDemo: true,
          onboardingCompletedAt: new Date(),
        })
        .returning({ id: profiles.id });
      return row!.id;
    }

    async function createSpacePost(ownerId: string, organizationId: string) {
      const [space] = await db
        .insert(spaces)
        .values({ name: "CADEV 2026", slug: "cadev-2026", createdBy: ownerId })
        .returning({ id: spaces.id });
      await db.insert(spaceMembers).values([
        { spaceId: space!.id, profileId: ownerId, role: "owner" },
        { spaceId: space!.id, profileId: organizationId, role: "member" },
      ]);
      const [post] = await db
        .insert(posts)
        .values({ authorId: organizationId, spaceId: space!.id, body: SPACE_POST })
        .returning({ id: posts.id });
      await db.insert(posts).values({ authorId: organizationId, body: OPEN_POST });
      return { spaceId: space!.id, postId: post!.id };
    }

    async function feedBodies(tab: string, cookie?: string): Promise<string[]> {
      const response = await app.inject({
        method: "GET",
        url: `/api/posts?tab=${tab}`,
        headers: cookie ? { cookie } : {},
      });
      expect(response.statusCode).toBe(200);
      return response.json().items.map((item: { body: string }) => item.body);
    }

    it("ne montre un post d'espace que dans le fil des membres de l'espace", async () => {
      const member = await createMember("membre-cadev");
      const outsider = await createMember("hors-espace");
      const organizationId = await createOrganization();
      const { postId } = await createSpacePost(member.profileId, organizationId);

      expect(await feedBodies("pour-toi", member.cookie)).toContain(SPACE_POST);
      expect(await feedBodies("pour-toi", outsider.cookie)).not.toContain(SPACE_POST);
      expect(await feedBodies("pour-toi", outsider.cookie)).toContain(OPEN_POST);
      expect(await feedBodies("pour-toi")).not.toContain(SPACE_POST);
      expect(await feedBodies("pour-toi")).toContain(OPEN_POST);

      // Abonnements : suivre l'auteur ne fait pas entrer son post d'espace dans le fil.
      await app.inject({
        method: "POST",
        url: "/api/users/organisation-test/follow",
        headers: { cookie: outsider.cookie },
      });
      expect(await feedBodies("abonnements", outsider.cookie)).toEqual([OPEN_POST]);

      await db.update(posts).set({ isBeginner: true });
      expect(await feedBodies("debuter")).toEqual([OPEN_POST]);
      expect(await feedBodies("debuter", member.cookie)).toContain(SPACE_POST);

      // Le bandeau épinglé de l'espace public mène au post : sa page reste lisible.
      const page = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
      expect(page.statusCode).toBe(200);
    });

    it("refuse toute demande de conversation à un profil sans compte de connexion", async () => {
      const member = await createMember("curieuse");
      await createOrganization();

      const profile = await app.inject({
        method: "GET",
        url: "/api/users/organisation-test",
        headers: { cookie: member.cookie },
      });
      expect(profile.json().acceptsMessages).toBe(false);
      const own = await app.inject({
        method: "GET",
        url: "/api/users/curieuse",
        headers: { cookie: member.cookie },
      });
      expect(own.json().acceptsMessages).toBe(true);

      const response = await app.inject({
        method: "POST",
        url: "/api/conversations",
        headers: { cookie: member.cookie },
        payload: { handles: ["organisation-test"] },
      });
      expect(response.statusCode).toBe(403);
    });

    it("ne propose jamais un profil sans compte de connexion parmi les personnes à suivre", async () => {
      const member = await createMember("nouvelle-venue");
      await createMember("autre-membre");
      await createOrganization();

      const response = await app.inject({
        method: "GET",
        url: "/api/me/onboarding/people",
        headers: { cookie: member.cookie },
      });
      expect(response.statusCode).toBe(200);
      const handles = response
        .json()
        .items.map((item: { profile: { handle: string } }) => item.profile.handle);
      expect(handles).toContain("autre-membre");
      expect(handles).not.toContain("organisation-test");
    });
  },
);
