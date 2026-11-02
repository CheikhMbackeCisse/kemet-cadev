import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, credentials, pointsLedger, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

function yearsAgo(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

describe.skipIf(!databaseUrl)("Parcours vérifié, niveau affiché et opportunités (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
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

  async function createMember(email: string, handle: string): Promise<{ cookie: string; profileId: string }> {
    await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { email, password: "une-passphrase-solide", name: handle } });
    const verificationUrl = new URL(extractVerificationUrl(email));
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: "une-passphrase-solide" } });
    const cookie = extractCookie(signIn);
    const me = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, profileId: me.json().profile.id as string };
  }

  async function createAdmin(email: string, handle: string) {
    const admin = await createMember(email, handle);
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, admin.profileId));
    return admin;
  }

  async function declareCredential(
    profileId: string,
    values: { type: "job" | "education" | "internship"; title: string; startDate: string; endDate?: string },
  ): Promise<string> {
    const [credential] = await db
      .insert(credentials)
      .values({ profileId, organization: "Entreprise", ...values })
      .returning({ id: credentials.id });
    return credential!.id;
  }

  function verify(cookie: string | null, credentialId: string) {
    return app.inject({
      method: "POST",
      url: `/api/credentials/${credentialId}/verification`,
      headers: cookie ? { cookie } : {},
      payload: { verificationMethod: "Attestation employeur" },
    });
  }

  async function getMe(cookie: string) {
    const response = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    return response.json() as { points: number; profile: { level: string; openToOpportunities: boolean } };
  }

  // Hors de la fenêtre de régularité, pour que le total soit exactement le montant donné.
  async function grantPoints(profileId: string, amount: number) {
    await db.insert(pointsLedger).values({
      profileId,
      source: "competition_victory",
      sourceId: crypto.randomUUID(),
      amount,
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    });
  }

  describe("parcours vérifié", () => {
    it("ne rapporte rien pour un élément seulement déclaré", async () => {
      const member = await createMember("declared@test.kemet", "declared");
      await declareCredential(member.profileId, { type: "job", title: "Lead backend", startDate: yearsAgo(5) });
      expect((await getMe(member.cookie)).points).toBe(0);
    });

    it("refuse la vérification à un visiteur et à un membre qui n'est pas administrateur", async () => {
      const member = await createMember("owner@test.kemet", "owner");
      const other = await createMember("other@test.kemet", "other");
      const credentialId = await declareCredential(member.profileId, { type: "internship", title: "Stage", startDate: yearsAgo(1) });

      expect((await verify(null, credentialId)).statusCode).toBe(401);
      expect((await verify(other.cookie, credentialId)).statusCode).toBe(403);
      expect((await verify(member.cookie, credentialId)).statusCode).toBe(403);
      expect((await getMe(member.cookie)).points).toBe(0);
    });

    it("refuse à un administrateur de vérifier son propre parcours", async () => {
      const admin = await createAdmin("admin-self@test.kemet", "adminself");
      const credentialId = await declareCredential(admin.profileId, { type: "internship", title: "Stage", startDate: yearsAgo(1) });
      expect((await verify(admin.cookie, credentialId)).statusCode).toBe(403);
    });

    it("refuse la vérification à un administrateur suspendu", async () => {
      const admin = await createAdmin("admin-suspended@test.kemet", "adminsuspended");
      await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, admin.profileId));
      const member = await createMember("victim@test.kemet", "victim");
      const credentialId = await declareCredential(member.profileId, { type: "internship", title: "Stage", startDate: yearsAgo(1) });

      expect((await verify(admin.cookie, credentialId)).statusCode).toBe(403);
      expect((await getMe(member.cookie)).points).toBe(0);
    });

    it("refuse une méthode de vérification absente ou trop courte", async () => {
      const admin = await createAdmin("admin-body@test.kemet", "adminbody");
      const member = await createMember("body@test.kemet", "body");
      const credentialId = await declareCredential(member.profileId, { type: "internship", title: "Stage", startDate: yearsAgo(1) });

      for (const payload of [{}, { verificationMethod: "ok" }]) {
        const response = await app.inject({
          method: "POST",
          url: `/api/credentials/${credentialId}/verification`,
          headers: { cookie: admin.cookie },
          payload,
        });
        expect(response.statusCode).toBe(400);
      }
      expect((await getMe(member.cookie)).points).toBe(0);
    });

    it("garde la trace de l'administrateur qui a vérifié, sans l'exposer", async () => {
      const admin = await createAdmin("admin-trace@test.kemet", "admintrace");
      const member = await createMember("traced@test.kemet", "traced");
      const credentialId = await declareCredential(member.profileId, { type: "internship", title: "Stage", startDate: yearsAgo(1) });

      const response = await verify(admin.cookie, credentialId);
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain(admin.profileId);
      const [row] = await db.select().from(credentials).where(eq(credentials.id, credentialId));
      expect(row!.verifiedByProfileId).toBe(admin.profileId);
      expect(row!.verifiedAt).toBeInstanceOf(Date);
    });

    it("inscrit les points du barème une seule fois, sans compter de jour actif", async () => {
      const admin = await createAdmin("admin@test.kemet", "admin");
      const member = await createMember("lead@test.kemet", "lead");
      const job = await declareCredential(member.profileId, { type: "job", title: "Lead backend", startDate: yearsAgo(3) });
      const degree = await declareCredential(member.profileId, {
        type: "education",
        title: "Master génie logiciel",
        startDate: yearsAgo(6),
        endDate: yearsAgo(4),
      });

      const first = await verify(admin.cookie, job);
      expect(first.statusCode).toBe(200);
      expect(first.json().credential).toMatchObject({ status: "verified", verificationMethod: "Attestation employeur" });
      expect((await verify(admin.cookie, degree)).statusCode).toBe(200);
      expect((await verify(admin.cookie, job)).statusCode).toBe(409);

      // 3 ans à 100, poste lead 300, diplôme 150 : pas de bonus de régularité.
      const me = await getMe(member.cookie);
      expect(me.points).toBe(750);
      expect(me.profile.level).toBe("artisan");
    });

    it("plafonne le parcours à 1 500 points", async () => {
      const admin = await createAdmin("admin-cap@test.kemet", "admincap");
      const member = await createMember("veteran@test.kemet", "veteran");
      const job = await declareCredential(member.profileId, { type: "job", title: "Architecte logiciel", startDate: yearsAgo(20) });
      await verify(admin.cookie, job);
      expect((await getMe(member.cookie)).points).toBe(1500);
    });

    it("répond 404 à un identifiant inconnu ou mal formé", async () => {
      const admin = await createAdmin("admin-404@test.kemet", "admin404");
      expect((await verify(admin.cookie, crypto.randomUUID())).statusCode).toBe(404);
      expect((await verify(admin.cookie, "pas-un-uuid")).statusCode).toBe(404);
    });
  });

  describe("Ouvert aux opportunités", () => {
    function setOpen(cookie: string, value: boolean) {
      return app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload: { openToOpportunities: value } });
    }

    it("est refusé sous Artisan et accepté à partir d'Artisan", async () => {
      const member = await createMember("open@test.kemet", "open");
      expect((await setOpen(member.cookie, true)).statusCode).toBe(403);
      expect((await setOpen(member.cookie, false)).statusCode).toBe(200);

      await grantPoints(member.profileId, 300);
      const accepted = await setOpen(member.cookie, true);
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json().profile.openToOpportunities).toBe(true);
    });

    it("est masqué à la lecture si le total repasse sous Artisan", async () => {
      const member = await createMember("masked@test.kemet", "masked");
      await grantPoints(member.profileId, 300);
      await setOpen(member.cookie, true);
      await grantPoints(member.profileId, -100);

      const publicProfile = await app.inject({ method: "GET", url: "/api/users/masked" });
      expect(publicProfile.json().profile.openToOpportunities).toBe(false);
    });
  });

  describe("niveau de l'auteur", () => {
    it("accompagne les posts, les réponses et les retours", async () => {
      const author = await createMember("scribe@test.kemet", "scribe");
      const replier = await createMember("artisan@test.kemet", "artisan");
      await grantPoints(author.profileId, 1000);
      await grantPoints(replier.profileId, 300);

      const question = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: author.cookie },
        payload: { body: "Une question ?", format: "question" },
      });
      expect(question.json().post.authorLevel).toBe("scribe");
      const postId = question.json().post.id as string;

      const reply = await app.inject({
        method: "POST",
        url: `/api/posts/${postId}/replies`,
        headers: { cookie: replier.cookie },
        payload: { body: "Voici la réponse." },
      });
      expect(reply.json().reply.authorLevel).toBe("artisan");

      const replies = await app.inject({ method: "GET", url: `/api/posts/${postId}/replies` });
      expect(replies.json().items[0].authorLevel).toBe("artisan");
      const feed = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" });
      expect(feed.json().items[0].authorLevel).toBe("scribe");

      const testPost = await app.inject({
        method: "POST",
        url: "/api/posts",
        headers: { cookie: author.cookie },
        payload: { body: "À tester", format: "a_tester", testUrl: "https://exemple.org", testAsk: "Ton avis ?" },
      });
      const feedback = await app.inject({
        method: "POST",
        url: `/api/posts/${testPost.json().post.id}/feedback`,
        headers: { cookie: replier.cookie },
        payload: { body: "Fonctionne bien sur mobile." },
      });
      expect(feedback.json().feedback.authorLevel).toBe("artisan");
    });

    it("accompagne les messages d'un salon", async () => {
      const member = await createMember("chat@test.kemet", "chat");
      await grantPoints(member.profileId, 2500);
      const space = await app.inject({
        method: "POST",
        url: "/api/spaces",
        headers: { cookie: member.cookie },
        payload: { name: "backend", slug: "backend", visibility: "public" },
      });
      const channels = await app.inject({
        method: "GET",
        url: `/api/spaces/${space.json().space.id}/channels`,
        headers: { cookie: member.cookie },
      });
      const channelId = channels.json().items[0].id as string;
      const sent = await app.inject({
        method: "POST",
        url: `/api/channels/${channelId}/messages`,
        headers: { cookie: member.cookie },
        payload: { clientId: crypto.randomUUID(), body: "Bonjour" },
      });
      expect(sent.json().message.authorLevel).toBe("architecte");

      const list = await app.inject({ method: "GET", url: `/api/channels/${channelId}/messages` });
      expect(list.json().items[0].authorLevel).toBe("architecte");
    });

    it("accompagne les candidatures vues par le propriétaire du projet", async () => {
      const owner = await createMember("project-owner@test.kemet", "projectowner");
      const applicant = await createMember("applicant@test.kemet", "applicant");
      await grantPoints(applicant.profileId, 1000);
      await app.inject({
        method: "POST",
        url: "/api/projects",
        headers: { cookie: owner.cookie },
        payload: { slug: "projet-niveaux", name: "Projet", pitch: "Un projet pour tester les niveaux.", repoUrl: "https://github.com/exemple/projet" },
      });
      const helpRequest = await app.inject({
        method: "POST",
        url: "/api/projects/projet-niveaux/help-requests",
        headers: { cookie: owner.cookie },
        payload: { title: "Cherche un dev", description: "Besoin d'un coup de main sur l'API." },
      });
      const helpRequestId = helpRequest.json().helpRequest.id as string;
      const applied = await app.inject({
        method: "POST",
        url: `/api/help-requests/${helpRequestId}/applications`,
        headers: { cookie: applicant.cookie },
        payload: { message: "Je peux aider sur ce point rapidement." },
      });
      expect(applied.json().application.applicantLevel).toBe("scribe");

      const list = await app.inject({
        method: "GET",
        url: `/api/help-requests/${helpRequestId}/applications`,
        headers: { cookie: owner.cookie },
      });
      expect(list.json().items[0].applicantLevel).toBe("scribe");
    });
  });
});
