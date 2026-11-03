import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import {
  account,
  createDb,
  credentials,
  follows,
  messageAttachments,
  messages,
  moderationActions,
  pointsLedger,
  postReplies,
  posts,
  profiles,
  reports,
  session,
  spaceMembers,
  spaces,
  user,
  type Db,
} from "@kemet/db";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { createNoopChatPublisher } from "../chat/pubsub.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { InMemoryStorage } from "../storage/file-storage.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();
const PASSWORD = "une-passphrase-solide";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
  "base64",
);

interface Member {
  cookie: string;
  userId: string;
  profileId: string;
}

describe.skipIf(!databaseUrl)("Suppression du compte (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let storage: InMemoryStorage;

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
      chat: createNoopChatPublisher(),
      storage,
      attachmentLimits: { maxAttachmentBytes: 1024 * 1024, maxUserStorageBytes: 10 * 1024 * 1024 },
    });
  });

  function extractCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers["set-cookie"];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value).split(";")[0]!;
  }

  async function signIn(email: string) {
    return app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: PASSWORD } });
  }

  async function createMember(email: string, handle: string): Promise<Member> {
    const signUp = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { email, password: PASSWORD, name: handle },
    });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const cookie = extractCookie(await signIn(email));
    const profile = await app.inject({
      method: "PATCH",
      url: "/api/me/profile",
      headers: { cookie },
      payload: { handle, displayName: handle, country: "SN" },
    });
    return { cookie, userId: signUp.json().user.id as string, profileId: profile.json().profile.id as string };
  }

  function deleteAccount(cookie: string | undefined, payload: object = { password: PASSWORD }) {
    return app.inject({ method: "DELETE", url: "/api/me", headers: cookie ? { cookie } : {}, payload });
  }

  async function createSpaceChannel(cookie: string, slug: string, visibility: "public" | "private" = "public") {
    const space = (
      await app.inject({ method: "POST", url: "/api/spaces", headers: { cookie }, payload: { name: slug, slug, visibility } })
    ).json().space as { id: string };
    const channels = (await app.inject({ method: "GET", url: `/api/spaces/${space.id}/channels`, headers: { cookie } })).json()
      .items as { id: string; slug: string }[];
    return { spaceId: space.id, channelId: channels.find((channel) => channel.slug === "general")!.id };
  }

  async function sendMessage(cookie: string, channelId: string, body: string, extra: object = {}) {
    const response = await app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages`,
      headers: { cookie },
      payload: { clientId: crypto.randomUUID(), body, ...extra },
    });
    return response.json().message as { id: string };
  }

  async function uploadImage(cookie: string, channelId: string) {
    const boundary = "----kemettestboundary";
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG_BYTES,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await app.inject({
      method: "POST",
      url: `/api/channels/${channelId}/messages/attachments`,
      headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    return response.json().attachment.id as string;
  }

  describe("autorisations", () => {
    it("refuse un visiteur", async () => {
      expect((await deleteAccount(undefined)).statusCode).toBe(401);
    });

    it("refuse un mot de passe absent ou faux, et ne touche à rien", async () => {
      const member = await createMember("amina@test.kemet", "amina");

      const missing = await deleteAccount(member.cookie, {});
      const wrong = await deleteAccount(member.cookie, { password: "pas-le-bon" });

      expect(missing.statusCode).toBe(403);
      expect(wrong.statusCode).toBe(403);
      expect(wrong.json().error.code).toBe("wrong_password");
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, member.profileId));
      expect(profile!.deletedAt).toBeNull();
      expect((await app.inject({ method: "GET", url: "/api/me", headers: { cookie: member.cookie } })).statusCode).toBe(200);
    });

    it("ne supprime que le compte de la session, quel que soit le corps envoyé", async () => {
      const amina = await createMember("amina@test.kemet", "amina");
      const kwame = await createMember("kwame@test.kemet", "kwame");

      const response = await deleteAccount(amina.cookie, { password: PASSWORD, userId: kwame.userId, profileId: kwame.profileId });

      expect(response.statusCode).toBe(204);
      const [kwameProfile] = await db.select().from(profiles).where(eq(profiles.id, kwame.profileId));
      expect(kwameProfile!.deletedAt).toBeNull();
      expect(kwameProfile!.handle).toBe("kwame");
      const [aminaProfile] = await db.select().from(profiles).where(eq(profiles.id, amina.profileId));
      expect(aminaProfile!.deletedAt).not.toBeNull();
    });

    it("exige une connexion de moins de cinq minutes pour un compte sans mot de passe", async () => {
      const member = await createMember("github@test.kemet", "github");
      // Un compte GitHub, Google ou LinkedIn n'a pas de ligne "credential".
      await db.update(account).set({ providerId: "github", password: null }).where(eq(account.userId, member.userId));
      await db
        .update(session)
        .set({ createdAt: new Date(Date.now() - 6 * 60_000) })
        .where(eq(session.userId, member.userId));

      const me = (await app.inject({ method: "GET", url: "/api/me", headers: { cookie: member.cookie } })).json();
      expect(me).toMatchObject({ hasPassword: false, socialProviders: ["github"] });

      const stale = await deleteAccount(member.cookie, {});
      expect(stale.statusCode).toBe(403);
      expect(stale.json().error.code).toBe("reauthentication_required");

      await db.update(session).set({ createdAt: new Date() }).where(eq(session.userId, member.userId));
      expect((await deleteAccount(member.cookie, {})).statusCode).toBe(204);
    });

    it("exige le mot de passe d'un compte qui en a un, même juste après une connexion GitHub", async () => {
      const member = await createMember("mixte@test.kemet", "mixte");
      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: "github-42",
        providerId: "github",
        userId: member.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.update(session).set({ createdAt: new Date() }).where(eq(session.userId, member.userId));

      const response = await deleteAccount(member.cookie, {});

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("wrong_password");
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, member.profileId));
      expect(profile!.deletedAt).toBeNull();
    });

    it("laisse un compte suspendu se supprimer", async () => {
      const member = await createMember("suspendu@test.kemet", "suspendu");
      await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, member.profileId));

      expect((await deleteAccount(member.cookie)).statusCode).toBe(204);
    });

    it("coupe l'ancienne session et la connexion par email", async () => {
      const member = await createMember("parti@test.kemet", "parti");

      expect((await deleteAccount(member.cookie)).statusCode).toBe(204);

      expect((await app.inject({ method: "GET", url: "/api/me", headers: { cookie: member.cookie } })).statusCode).toBe(401);
      expect((await signIn("parti@test.kemet")).statusCode).not.toBe(200);
      expect(await db.select().from(user).where(eq(user.id, member.userId))).toHaveLength(0);
      expect(await db.select().from(session).where(eq(session.userId, member.userId))).toHaveLength(0);
      expect(await db.select().from(account).where(eq(account.userId, member.userId))).toHaveLength(0);
    });

    it("refuse de choisir un identifiant réservé aux comptes supprimés", async () => {
      const member = await createMember("malin@test.kemet", "malin");
      const response = await app.inject({
        method: "PATCH",
        url: "/api/me/profile",
        headers: { cookie: member.cookie },
        payload: { handle: "supprime-abcdefgh" },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("intégrité", () => {
    it("garde les contenus et les fils des autres, sous Compte supprimé, sans donnée personnelle", async () => {
      const amina = await createMember("amina@test.kemet", "amina");
      const kwame = await createMember("kwame@test.kemet", "kwame");
      const { spaceId, channelId } = await createSpaceChannel(kwame.cookie, "entraide");
      await app.inject({ method: "POST", url: `/api/spaces/${spaceId}/members`, headers: { cookie: kwame.cookie }, payload: { handle: "amina" } });

      const question = await sendMessage(amina.cookie, channelId, "Comment tester un webhook ?");
      const answer = await sendMessage(kwame.cookie, channelId, "Avec un tunnel local.", { parentMessageId: question.id });
      const hidden = await sendMessage(amina.cookie, channelId, "Message que je regrette");
      await app.inject({ method: "DELETE", url: `/api/messages/${hidden.id}`, headers: { cookie: amina.cookie } });

      const post = (
        await app.inject({ method: "POST", url: "/api/posts", headers: { cookie: amina.cookie }, payload: { body: "Mon astuce" } })
      ).json().post as { id: string };
      await app.inject({
        method: "POST",
        url: `/api/posts/${post.id}/replies`,
        headers: { cookie: kwame.cookie },
        payload: { body: "Merci pour l'astuce" },
      });
      await app.inject({ method: "POST", url: `/api/users/kwame/follow`, headers: { cookie: amina.cookie } });
      await app.inject({ method: "POST", url: `/api/users/amina/follow`, headers: { cookie: kwame.cookie } });
      await db.insert(credentials).values({
        profileId: amina.profileId,
        type: "education",
        organization: "EPT",
        title: "Ingénieur",
        startDate: "2020-09-01",
      });

      expect((await deleteAccount(amina.cookie)).statusCode).toBe(204);

      const [profile] = await db.select().from(profiles).where(eq(profiles.id, amina.profileId));
      expect(profile).toMatchObject({
        userId: null,
        displayName: "Compte supprimé",
        country: "",
        bio: null,
        title: null,
        avatarUrl: null,
        githubUrl: null,
        stack: [],
      });
      expect(profile!.handle).toMatch(/^supprime-[a-z0-9]{8}$/);
      expect(await db.select().from(follows).where(eq(follows.followerId, amina.profileId))).toHaveLength(0);
      expect(await db.select().from(follows).where(eq(follows.followeeId, amina.profileId))).toHaveLength(0);
      expect(await db.select().from(spaceMembers).where(eq(spaceMembers.profileId, amina.profileId))).toHaveLength(0);
      expect(await db.select().from(credentials).where(eq(credentials.profileId, amina.profileId))).toHaveLength(0);

      const threadMessages = await db.select().from(messages).where(eq(messages.channelId, channelId));
      expect(threadMessages.find((row) => row.id === question.id)?.body).toBe("Comment tester un webhook ?");
      expect(threadMessages.find((row) => row.id === answer.id)?.parentMessageId).toBe(question.id);
      expect(threadMessages.find((row) => row.id === hidden.id)?.body).toBe("");
      expect(await db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
      expect(await db.select().from(postReplies).where(eq(postReplies.postId, post.id))).toHaveLength(1);

      const thread = await app.inject({ method: "GET", url: `/api/messages/${question.id}/replies`, headers: { cookie: kwame.cookie } });
      expect(thread.statusCode).toBe(200);
      expect(thread.body).not.toContain("amina@test.kemet");

      const feed = await app.inject({ method: "GET", url: `/api/posts/${post.id}`, headers: { cookie: kwame.cookie } });
      expect(feed.json().post.authorDisplayName).toBe("Compte supprimé");
      expect(feed.body).not.toContain('"amina"');

      expect((await app.inject({ method: "GET", url: "/api/users/amina" })).statusCode).toBe(404);
      expect((await app.inject({ method: "GET", url: `/api/users/${profile!.handle}` })).statusCode).toBe(404);
    });

    it("passe la propriété d'un espace à l'administrateur puis au membre le plus ancien, ou archive l'espace", async () => {
      const owner = await createMember("proprio@test.kemet", "proprio");
      const admin = await createMember("admin@test.kemet", "admin");
      const early = await createMember("ancien@test.kemet", "ancien");
      const late = await createMember("recent@test.kemet", "recent");
      const withAdmin = await createSpaceChannel(owner.cookie, "avec-admin");
      const withMembers = await createSpaceChannel(owner.cookie, "avec-membres");
      const alone = await createSpaceChannel(owner.cookie, "seul");
      const day = 24 * 60 * 60_000;
      await db.insert(spaceMembers).values([
        { spaceId: withAdmin.spaceId, profileId: early.profileId, role: "member", joinedAt: new Date(Date.now() - 3 * day) },
        { spaceId: withAdmin.spaceId, profileId: admin.profileId, role: "admin", joinedAt: new Date(Date.now() - day) },
        { spaceId: withMembers.spaceId, profileId: late.profileId, role: "member", joinedAt: new Date(Date.now() - day) },
        { spaceId: withMembers.spaceId, profileId: early.profileId, role: "member", joinedAt: new Date(Date.now() - 2 * day) },
      ]);

      expect((await deleteAccount(owner.cookie)).statusCode).toBe(204);

      async function roleOf(spaceId: string, profileId: string) {
        const [row] = await db
          .select({ role: spaceMembers.role })
          .from(spaceMembers)
          .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, profileId)));
        return row?.role;
      }
      expect(await roleOf(withAdmin.spaceId, admin.profileId)).toBe("owner");
      expect(await roleOf(withAdmin.spaceId, early.profileId)).toBe("member");
      expect(await roleOf(withMembers.spaceId, early.profileId)).toBe("owner");
      expect(await roleOf(withMembers.spaceId, late.profileId)).toBe("member");

      const archived = await db.select().from(spaces).where(eq(spaces.id, alone.spaceId));
      expect(archived[0]!.archivedAt).not.toBeNull();
      const kept = await db.select().from(spaces).where(eq(spaces.id, withAdmin.spaceId));
      expect(kept[0]!.archivedAt).toBeNull();

      const listed = (await app.inject({ method: "GET", url: "/api/spaces", headers: { cookie: late.cookie } })).json()
        .items as { id: string }[];
      expect(listed.map((space) => space.id)).not.toContain(alone.spaceId);
      expect(listed.map((space) => space.id)).toContain(withMembers.spaceId);
      const write = await app.inject({
        method: "POST",
        url: `/api/channels/${alone.channelId}/messages`,
        headers: { cookie: late.cookie },
        payload: { clientId: crypto.randomUUID(), body: "Encore là ?" },
      });
      expect(write.statusCode).toBe(403);
      expect(write.json().error.message).toBe("Cet espace est archivé.");
    });

    it("ferme un espace privé archivé : invitation, fichier et réaction refusés", async () => {
      const owner = await createMember("proprio@test.kemet", "proprio");
      const visitor = await createMember("visiteur@test.kemet", "visiteur");
      const { spaceId, channelId } = await createSpaceChannel(owner.cookie, "prive", "private");
      const message = await sendMessage(owner.cookie, channelId, "Dernier message");
      const invite = (
        await app.inject({ method: "POST", url: `/api/spaces/${spaceId}/invites`, headers: { cookie: owner.cookie }, payload: {} })
      ).json().invite as { code: string };

      expect((await deleteAccount(owner.cookie)).statusCode).toBe(204);

      const preview = await app.inject({ method: "GET", url: `/api/invites/${invite.code}` });
      expect(preview.json().status).toBe("revoked");
      const accept = await app.inject({
        method: "POST",
        url: `/api/invites/${invite.code}/accept`,
        headers: { cookie: visitor.cookie },
      });
      expect(accept.json()).toMatchObject({ joined: false, status: "revoked" });
      const [membership] = await db
        .select()
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, visitor.profileId)));
      expect(membership).toBeUndefined();

      // Un membre resté par erreur ne pourrait rien écrire non plus.
      await db.insert(spaceMembers).values({ spaceId, profileId: visitor.profileId, role: "member" });
      const reaction = await app.inject({
        method: "PUT",
        url: `/api/messages/${message.id}/reactions`,
        headers: { cookie: visitor.cookie },
        payload: { emoji: "+1" },
      });
      expect(reaction.statusCode).toBe(403);
      const boundary = "----kemettestboundary";
      const upload = await app.inject({
        method: "POST",
        url: `/api/channels/${channelId}/messages/attachments`,
        headers: { cookie: visitor.cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.concat([
          Buffer.from(`--${boundary}
Content-Disposition: form-data; name="file"; filename="photo.png"
Content-Type: image/png

`),
          PNG_BYTES,
          Buffer.from(`
--${boundary}--
`),
        ]),
      });
      expect(upload.statusCode).toBe(403);
    });

    it("archive l'espace quand son propriétaire et son seul membre partent en même temps", async () => {
      const owner = await createMember("proprio@test.kemet", "proprio");
      const member = await createMember("membre@test.kemet", "membre");
      const { spaceId } = await createSpaceChannel(owner.cookie, "duo");
      await db.insert(spaceMembers).values({ spaceId, profileId: member.profileId, role: "member" });

      const [first, second] = await Promise.all([deleteAccount(owner.cookie), deleteAccount(member.cookie)]);

      expect(first.statusCode).toBe(204);
      expect(second.statusCode).toBe(204);
      const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId));
      expect(space!.archivedAt).not.toBeNull();
    });

    it("préfère un successeur actif à un administrateur suspendu", async () => {
      const owner = await createMember("proprio@test.kemet", "proprio");
      const suspended = await createMember("suspendu@test.kemet", "suspendu");
      const active = await createMember("actif@test.kemet", "actif");
      const { spaceId } = await createSpaceChannel(owner.cookie, "relais");
      await db.insert(spaceMembers).values([
        { spaceId, profileId: suspended.profileId, role: "admin", joinedAt: new Date(Date.now() - 60_000) },
        { spaceId, profileId: active.profileId, role: "member" },
      ]);
      await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, suspended.profileId));

      expect((await deleteAccount(owner.cookie)).statusCode).toBe(204);

      const [row] = await db
        .select({ role: spaceMembers.role })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, active.profileId)));
      expect(row!.role).toBe("owner");
    });

    it("transmet la propriété quand le propriétaire quitte l'espace, et personne ne peut le retirer", async () => {
      const owner = await createMember("proprio@test.kemet", "proprio");
      const admin = await createMember("admin@test.kemet", "admin");
      const { spaceId } = await createSpaceChannel(owner.cookie, "depart");
      await db.insert(spaceMembers).values({ spaceId, profileId: admin.profileId, role: "admin" });

      const kick = await app.inject({
        method: "DELETE",
        url: `/api/spaces/${spaceId}/members/${owner.profileId}`,
        headers: { cookie: admin.cookie },
      });
      expect(kick.statusCode).toBe(403);

      const leave = await app.inject({
        method: "DELETE",
        url: `/api/spaces/${spaceId}/members/${owner.profileId}`,
        headers: { cookie: owner.cookie },
      });
      expect(leave.statusCode).toBe(200);
      const [row] = await db
        .select({ role: spaceMembers.role })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.profileId, admin.profileId)));
      expect(row!.role).toBe("owner");
    });

    it("efface les fichiers du disque et les marque supprimés", async () => {
      const amina = await createMember("amina@test.kemet", "amina");
      const { channelId } = await createSpaceChannel(amina.cookie, "images");
      const attachmentId = await uploadImage(amina.cookie, channelId);
      const sent = await sendMessage(amina.cookie, channelId, "Une capture", { attachmentIds: [attachmentId] });
      const kwame = await createMember("kwame@test.kemet", "kwame");
      const before = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: kwame.cookie } });
      expect(before.statusCode).toBe(200);

      expect((await deleteAccount(amina.cookie)).statusCode).toBe(204);

      const content = await app.inject({ method: "GET", url: `/api/attachments/${attachmentId}/content`, headers: { cookie: kwame.cookie } });
      expect(content.statusCode).toBe(404);
      const history = await app.inject({ method: "GET", url: `/api/channels/${channelId}/messages`, headers: { cookie: kwame.cookie } });
      const message = (history.json().items as { id: string; attachments: { removed: boolean }[] }[]).find((item) => item.id === sent.id);
      expect(message!.attachments).toEqual([expect.objectContaining({ removed: true })]);
      const [file] = await db.select().from(messageAttachments).where(eq(messageAttachments.id, attachmentId));
      expect(() => storage.read(file!.storageKey)).toThrow();
    });

    it("garde le registre de points, les signalements et le journal de modération, sans nom", async () => {
      const amina = await createMember("amina@test.kemet", "amina");
      const kwame = await createMember("kwame@test.kemet", "kwame");
      await db.insert(pointsLedger).values({
        profileId: amina.profileId,
        source: "post_reply_solution",
        sourceId: crypto.randomUUID(),
        amount: 15,
      });
      const [report] = await db
        .insert(reports)
        .values({ reporterId: kwame.profileId, targetType: "profile", targetId: amina.profileId, reason: "Spam" })
        .returning();
      await db.insert(reports).values({ reporterId: amina.profileId, targetType: "profile", targetId: kwame.profileId, reason: "Test" });
      await db.insert(moderationActions).values({
        actorId: amina.profileId,
        action: "account_suspended",
        targetType: "profile",
        targetId: kwame.profileId,
        reportId: report!.id,
      });

      expect((await deleteAccount(amina.cookie)).statusCode).toBe(204);

      expect(await db.select().from(pointsLedger).where(eq(pointsLedger.profileId, amina.profileId))).toHaveLength(1);
      expect(await db.select().from(reports).where(eq(reports.targetId, amina.profileId))).toHaveLength(1);
      expect(await db.select().from(reports).where(eq(reports.reporterId, amina.profileId))).toHaveLength(1);
      expect(await db.select().from(moderationActions).where(eq(moderationActions.actorId, amina.profileId))).toHaveLength(1);
    });
  });
});
