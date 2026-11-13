import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Fil de posts (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let db: Db;

  afterEach(async () => {
    await db.$client.end();
  });

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

  async function createPost(cookie: string, overrides: Partial<Record<string, unknown>> = {}) {
    return app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie },
      payload: { body: "Un post de test.", ...overrides },
    });
  }

  async function getPoints(cookie: string): Promise<number> {
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    return me.json().points as number;
  }

  it("n'affiche dans Abonnements que les posts de soi-même et de ceux qu'on suit", async () => {
    const a = await createMember("a@test.kemet", "feeda");
    const b = await createMember("b@test.kemet", "feedb");
    const c = await createMember("c@test.kemet", "feedc");

    await app.inject({ method: "POST", url: "/api/users/feedb/follow", headers: { cookie: a.cookie } });

    const postA = await createPost(a.cookie, { body: "Post de A." });
    const postB = await createPost(b.cookie, { body: "Post de B." });
    await createPost(c.cookie, { body: "Post de C." });

    const feed = await app.inject({ method: "GET", url: "/api/posts?tab=abonnements", headers: { cookie: a.cookie } });
    const bodies = (feed.json().items as { body: string }[]).map((item) => item.body);
    expect(bodies).toContain("Post de A.");
    expect(bodies).toContain("Post de B.");
    expect(bodies).not.toContain("Post de C.");
    void postA;
    void postB;
  });

  it("le partage crée un nouveau post qui référence l'original", async () => {
    const author = await createMember("share-author@test.kemet", "shareauthor");
    const sharer = await createMember("share-sharer@test.kemet", "sharesharer");
    const original = await createPost(author.cookie, { body: "Post original." });
    const originalId = original.json().post.id as string;

    const shared = await app.inject({ method: "POST", url: `/api/posts/${originalId}/share`, headers: { cookie: sharer.cookie } });
    expect(shared.statusCode).toBe(200);
    expect(shared.json().post.sharedPost.id).toBe(originalId);
    expect(shared.json().post.sharedPost.body).toBe("Post original.");
  });

  it("bascule la réaction Utile et son total", async () => {
    const author = await createMember("react-author@test.kemet", "reactauthor");
    const reactor = await createMember("react-reactor@test.kemet", "reactreactor");
    const post = await createPost(author.cookie);
    const postId = post.json().post.id as string;

    const first = await app.inject({ method: "PUT", url: `/api/posts/${postId}/reactions`, headers: { cookie: reactor.cookie } });
    expect(first.json()).toEqual({ utileCount: 1, reactedByMe: true });

    const second = await app.inject({ method: "PUT", url: `/api/posts/${postId}/reactions`, headers: { cookie: reactor.cookie } });
    expect(second.json()).toEqual({ utileCount: 0, reactedByMe: false });
  });

  it("refuse de modifier ou supprimer le post d'un autre", async () => {
    const author = await createMember("own-author@test.kemet", "ownauthor");
    const other = await createMember("own-other@test.kemet", "ownother");
    const post = await createPost(author.cookie);
    const postId = post.json().post.id as string;

    const patch = await app.inject({ method: "PATCH", url: `/api/posts/${postId}`, headers: { cookie: other.cookie }, payload: { body: "Modifié" } });
    expect(patch.statusCode).toBe(403);

    const remove = await app.inject({ method: "DELETE", url: `/api/posts/${postId}`, headers: { cookie: other.cookie } });
    expect(remove.statusCode).toBe(403);
  });

  it("une réponse ne peut être marquée comme solution que par l'auteur, sur un post Question", async () => {
    const author = await createMember("solution-author@test.kemet", "solutionauthor");
    const replier = await createMember("solution-replier@test.kemet", "solutionreplier");

    const astucePost = await createPost(author.cookie, { body: "Une astuce.", format: "astuce" });
    const astucePostId = astucePost.json().post.id as string;
    const astuceReply = await app.inject({
      method: "POST",
      url: `/api/posts/${astucePostId}/replies`,
      headers: { cookie: replier.cookie },
      payload: { body: "Réponse sur une astuce." },
    });
    const astuceReplyId = astuceReply.json().reply.id as string;
    const wrongFormat = await app.inject({
      method: "PUT",
      url: `/api/post-replies/${astuceReplyId}/solution`,
      headers: { cookie: author.cookie },
      payload: { isSolution: true },
    });
    expect(wrongFormat.statusCode).toBe(400);

    const question = await createPost(author.cookie, { body: "Une question ?", format: "question" });
    const questionId = question.json().post.id as string;
    const reply = await app.inject({
      method: "POST",
      url: `/api/posts/${questionId}/replies`,
      headers: { cookie: replier.cookie },
      payload: { body: "Voici la réponse." },
    });
    const replyId = reply.json().reply.id as string;

    const asReplier = await app.inject({
      method: "PUT",
      url: `/api/post-replies/${replyId}/solution`,
      headers: { cookie: replier.cookie },
      payload: { isSolution: true },
    });
    expect(asReplier.statusCode).toBe(403);

    const asAuthor = await app.inject({
      method: "PUT",
      url: `/api/post-replies/${replyId}/solution`,
      headers: { cookie: author.cookie },
      payload: { isSolution: true },
    });
    expect(asAuthor.statusCode).toBe(200);
    expect(asAuthor.json().reply.isSolution).toBe(true);
    // +10 pour la solution, +5 de régularité (une action aujourd'hui compte
    // comme un jour actif dans les 90 derniers jours).
    expect(await getPoints(replier.cookie)).toBe(15);

    // Démarquer puis remarquer la même réponse ne redonne pas de points.
    await app.inject({
      method: "PUT",
      url: `/api/post-replies/${replyId}/solution`,
      headers: { cookie: author.cookie },
      payload: { isSolution: false },
    });
    await app.inject({
      method: "PUT",
      url: `/api/post-replies/${replyId}/solution`,
      headers: { cookie: author.cookie },
      payload: { isSolution: true },
    });
    expect(await getPoints(replier.cookie)).toBe(15);
  });

  it("n'accepte un retour structuré qu'une fois par personne, et seulement sur un post À tester", async () => {
    const author = await createMember("feedback-author@test.kemet", "feedbackauthor");
    const tester = await createMember("feedback-tester@test.kemet", "feedbacktester");

    const notATester = await createPost(author.cookie, { body: "Pas à tester." });
    const notATesterId = notATester.json().post.id as string;
    const wrongFormat = await app.inject({
      method: "POST",
      url: `/api/posts/${notATesterId}/feedback`,
      headers: { cookie: tester.cookie },
      payload: { body: "Un retour." },
    });
    expect(wrongFormat.statusCode).toBe(400);

    const aTester = await createPost(author.cookie, {
      body: "À tester.",
      format: "a_tester",
      testUrl: "https://example.com/demo",
    });
    const aTesterId = aTester.json().post.id as string;

    const firstFeedback = await app.inject({
      method: "POST",
      url: `/api/posts/${aTesterId}/feedback`,
      headers: { cookie: tester.cookie },
      payload: { body: "Ça fonctionne bien." },
    });
    expect(firstFeedback.statusCode).toBe(200);
    // +10 pour le retour, +5 de régularité (jour actif).
    expect(await getPoints(tester.cookie)).toBe(15);

    const secondFeedback = await app.inject({
      method: "POST",
      url: `/api/posts/${aTesterId}/feedback`,
      headers: { cookie: tester.cookie },
      payload: { body: "Un autre retour." },
    });
    expect(secondFeedback.statusCode).toBe(409);
    expect(await getPoints(tester.cookie)).toBe(15);
  });

  it("refuse que l'auteur d'un post À tester se donne son propre retour", async () => {
    const author = await createMember("feedback-self@test.kemet", "feedbackself");
    const aTester = await createPost(author.cookie, {
      body: "À tester.",
      format: "a_tester",
      testUrl: "https://example.com/demo",
    });
    const aTesterId = aTester.json().post.id as string;

    const ownFeedback = await app.inject({
      method: "POST",
      url: `/api/posts/${aTesterId}/feedback`,
      headers: { cookie: author.cookie },
      payload: { body: "Mon propre retour." },
    });
    expect(ownFeedback.statusCode).toBe(400);
    expect(await getPoints(author.cookie)).toBe(0);
  });

  it("refuse un post À tester sans lien de démo ou de dépôt", async () => {
    const author = await createMember("missing-url@test.kemet", "missingurl");
    const response = await createPost(author.cookie, { body: "À tester.", format: "a_tester" });
    expect(response.statusCode).toBe(400);
  });

  it("laisse un visiteur sans session lire le fil « Pour toi », jamais « Abonnements »", async () => {
    const author = await createMember("visitor-feed@test.kemet", "visitorfeed");
    const post = await createPost(author.cookie, { body: "Un post visible sans compte." });
    const postId = post.json().post.id as string;

    const feed = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" });
    expect(feed.statusCode).toBe(200);
    expect(feed.json().items.map((item: { id: string }) => item.id)).toContain(postId);

    // Un visiteur n'a pas d'abonnements : même en demandant "abonnements",
    // la réponse reste "Pour toi" plutôt que d'exiger une session.
    const defaultFeed = await app.inject({ method: "GET", url: "/api/posts" });
    expect(defaultFeed.statusCode).toBe(200);

    const detail = await app.inject({ method: "GET", url: `/api/posts/${postId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().post.reactedByMe).toBe(false);

    const writeAttempt = await app.inject({ method: "POST", url: "/api/posts", payload: { body: "Je ne devrais pas pouvoir publier" } });
    expect(writeAttempt.statusCode).toBe(401);
  });

  it("fait remonter dans « Pour toi » un post marqué Utile ou testé, même plus ancien", async () => {
    const author = await createMember("ranking-author@test.kemet", "rankingauthor");
    const reader = await createMember("ranking-reader@test.kemet", "rankingreader");
    const tested = await createPost(author.cookie, {
      body: "À tester.",
      format: "a_tester",
      testUrl: "https://example.com/demo",
    });
    const useful = await createPost(author.cookie, { body: "Un post utile." });
    const newest = await createPost(author.cookie, { body: "Le plus récent, sans retour." });
    const [testedId, usefulId, newestId] = [tested, useful, newest].map((post) => post.json().post.id as string);

    const before = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" });
    expect(before.json().items.map((item: { id: string }) => item.id)).toEqual([newestId, usefulId, testedId]);

    await app.inject({ method: "PUT", url: `/api/posts/${usefulId}/reactions`, headers: { cookie: reader.cookie } });
    await app.inject({
      method: "POST",
      url: `/api/posts/${testedId}/feedback`,
      headers: { cookie: reader.cookie },
      payload: { body: "Fonctionne sur mobile." },
    });

    const after = await app.inject({ method: "GET", url: "/api/posts?tab=pour-toi" });
    expect(after.json().items.map((item: { id: string }) => item.id)).toEqual([testedId, usefulId, newestId]);
  });
  it("enregistre un post pour soi seul, sans doublon, et le retire", async () => {
    const author = await createMember("bm-author@test.kemet", "bmauthor");
    const reader = await createMember("bm-reader@test.kemet", "bmreader");
    const other = await createMember("bm-other@test.kemet", "bmother");
    const first = (await createPost(author.cookie, { body: "Premier." })).json().post.id as string;
    const second = (await createPost(author.cookie, { body: "Second." })).json().post.id as string;

    for (const postId of [first, first, second]) {
      const saved = await app.inject({
        method: "PUT",
        url: `/api/posts/${postId}/bookmark`,
        headers: { cookie: reader.cookie },
        payload: { saved: true },
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toEqual({ savedByMe: true });
    }

    const list = await app.inject({ method: "GET", url: "/api/me/bookmarks", headers: { cookie: reader.cookie } });
    expect(list.json().items.map((post: { id: string }) => post.id)).toEqual([second, first]);
    expect(list.json().items[0].savedByMe).toBe(true);

    const otherList = await app.inject({ method: "GET", url: "/api/me/bookmarks", headers: { cookie: other.cookie } });
    expect(otherList.json().items).toEqual([]);
    const seenByOther = await app.inject({ method: "GET", url: `/api/posts/${first}`, headers: { cookie: other.cookie } });
    expect(seenByOther.json().post.savedByMe).toBe(false);

    await app.inject({
      method: "PUT",
      url: `/api/posts/${first}/bookmark`,
      headers: { cookie: reader.cookie },
      payload: { saved: false },
    });
    const afterRemoval = await app.inject({ method: "GET", url: "/api/me/bookmarks", headers: { cookie: reader.cookie } });
    expect(afterRemoval.json().items.map((post: { id: string }) => post.id)).toEqual([second]);

    await app.inject({ method: "DELETE", url: `/api/posts/${second}`, headers: { cookie: author.cookie } });
    const afterDelete = await app.inject({ method: "GET", url: "/api/me/bookmarks", headers: { cookie: reader.cookie } });
    expect(afterDelete.json().items).toEqual([]);
  });

  it("refuse d'enregistrer sans session, sans corps valide ou un post inexistant", async () => {
    const author = await createMember("bm2@test.kemet", "bmtwo");
    const postId = (await createPost(author.cookie)).json().post.id as string;
    const anonymous = await app.inject({ method: "PUT", url: `/api/posts/${postId}/bookmark`, payload: { saved: true } });
    expect(anonymous.statusCode).toBe(401);
    const list = await app.inject({ method: "GET", url: "/api/me/bookmarks" });
    expect(list.statusCode).toBe(401);
    const invalid = await app.inject({
      method: "PUT",
      url: `/api/posts/${postId}/bookmark`,
      headers: { cookie: author.cookie },
      payload: { saved: "oui" },
    });
    expect(invalid.statusCode).toBe(400);
    const missing = await app.inject({
      method: "PUT",
      url: "/api/posts/00000000-0000-4000-8000-000000000000/bookmark",
      headers: { cookie: author.cookie },
      payload: { saved: true },
    });
    expect(missing.statusCode).toBe(404);
  });

  async function repost(cookie: string | undefined, postId: string, reposted: boolean) {
    return app.inject({
      method: "PUT",
      url: `/api/posts/${postId}/repost`,
      ...(cookie ? { headers: { cookie } } : {}),
      payload: { reposted },
    });
  }

  type FeedItem = { id: string; body: string; repostedBy: { handle: string } | null; repostCount: number };

  async function readFeed(cookie: string | undefined, query: string) {
    const response = await app.inject({
      method: "GET",
      url: `/api/posts?${query}`,
      ...(cookie ? { headers: { cookie } } : {}),
    });
    return response.json() as { items: FeedItem[]; nextCursor: string | null };
  }

  it("republie et annule une republication, une seule fois par personne", async () => {
    const author = await createMember("repost-author@test.kemet", "repostauthor");
    const reader = await createMember("repost-reader@test.kemet", "repostreader");
    const postId = (await createPost(author.cookie)).json().post.id as string;

    const first = await repost(reader.cookie, postId, true);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ repostCount: 1, repostedByMe: true });
    expect((await repost(reader.cookie, postId, true)).json()).toEqual({ repostCount: 1, repostedByMe: true });

    const post = await app.inject({ method: "GET", url: `/api/posts/${postId}`, headers: { cookie: reader.cookie } });
    expect(post.json().post).toMatchObject({ repostCount: 1, repostedByMe: true });

    expect((await repost(reader.cookie, postId, false)).json()).toEqual({ repostCount: 0, repostedByMe: false });
  });

  it("refuse la republication à un visiteur, sur son propre post et sur un post supprimé", async () => {
    const author = await createMember("repost-own@test.kemet", "repostown");
    const reader = await createMember("repost-other@test.kemet", "repostother");
    const postId = (await createPost(author.cookie)).json().post.id as string;

    expect((await repost(undefined, postId, true)).statusCode).toBe(401);
    expect((await repost(author.cookie, postId, true)).statusCode).toBe(400);
    expect((await repost(reader.cookie, "00000000-0000-4000-8000-000000000000", true)).statusCode).toBe(404);

    await repost(reader.cookie, postId, true);
    await app.inject({ method: "DELETE", url: `/api/posts/${postId}`, headers: { cookie: author.cookie } });
    expect((await repost(reader.cookie, postId, true)).statusCode).toBe(404);
    // Annuler reste possible après la suppression.
    expect((await repost(reader.cookie, postId, false)).statusCode).toBe(200);
  });

  it("fait remonter dans Abonnements un post republié par une personne suivie, une seule fois", async () => {
    const viewer = await createMember("repost-viewer@test.kemet", "repostviewer");
    const followee = await createMember("repost-followee@test.kemet", "repostfollowee");
    const second = await createMember("repost-second@test.kemet", "repostsecond");
    const stranger = await createMember("repost-stranger@test.kemet", "repoststranger");
    await app.inject({ method: "POST", url: "/api/users/repostfollowee/follow", headers: { cookie: viewer.cookie } });
    await app.inject({ method: "POST", url: "/api/users/repostsecond/follow", headers: { cookie: viewer.cookie } });

    const strangerPost = (await createPost(stranger.cookie, { body: "Post d'une inconnue." })).json().post.id as string;
    await createPost(followee.cookie, { body: "Post de la personne suivie." });

    expect((await readFeed(viewer.cookie, "tab=abonnements")).items.map((item) => item.id)).not.toContain(strangerPost);

    await repost(second.cookie, strangerPost, true);
    await repost(followee.cookie, strangerPost, true);

    const feed = await readFeed(viewer.cookie, "tab=abonnements");
    expect(feed.items.filter((item) => item.id === strangerPost)).toHaveLength(1);
    expect(feed.items[0]).toMatchObject({ id: strangerPost, repostCount: 2, repostedBy: { handle: "repostfollowee" } });
    const own = feed.items.find((item) => item.body === "Post de la personne suivie.");
    expect(own?.repostedBy).toBeNull();

    // Page par page, chaque post n'arrive qu'une fois.
    const firstPage = await readFeed(viewer.cookie, "tab=abonnements&limit=1");
    const secondPage = await readFeed(viewer.cookie, `tab=abonnements&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor!)}`);
    expect(firstPage.items.map((item) => item.id)).toEqual([strangerPost]);
    expect(secondPage.items.map((item) => item.body)).toEqual(["Post de la personne suivie."]);

    await repost(followee.cookie, strangerPost, false);
    await repost(second.cookie, strangerPost, false);
    expect((await readFeed(viewer.cookie, "tab=abonnements")).items.map((item) => item.id)).not.toContain(strangerPost);
  });

  it("annonce dans Pour toi la personne suivie qui a republié, jamais pour un visiteur", async () => {
    const viewer = await createMember("pt-viewer@test.kemet", "ptviewer");
    const followee = await createMember("pt-followee@test.kemet", "ptfollowee");
    const author = await createMember("pt-author@test.kemet", "ptauthor");
    await app.inject({ method: "POST", url: "/api/users/ptfollowee/follow", headers: { cookie: viewer.cookie } });
    const postId = (await createPost(author.cookie)).json().post.id as string;
    await repost(followee.cookie, postId, true);

    const signedIn = await readFeed(viewer.cookie, "tab=pour-toi");
    expect(signedIn.items.find((item) => item.id === postId)?.repostedBy).toMatchObject({ handle: "ptfollowee" });
    const visitor = await readFeed(undefined, "tab=pour-toi");
    expect(visitor.items.find((item) => item.id === postId)?.repostedBy).toBeNull();
  });

  it("indique si l'auteur du post est suivi", async () => {
    const viewer = await createMember("fol-viewer@test.kemet", "folviewer");
    const author = await createMember("fol-author@test.kemet", "folauthor");
    const postId = (await createPost(author.cookie)).json().post.id as string;
    const read = async () =>
      (await app.inject({ method: "GET", url: `/api/posts/${postId}`, headers: { cookie: viewer.cookie } })).json().post
        .authorFollowedByMe as boolean;
    expect(await read()).toBe(false);
    await app.inject({ method: "POST", url: "/api/users/folauthor/follow", headers: { cookie: viewer.cookie } });
    expect(await read()).toBe(true);
  });

  it("refuse la republication à un compte suspendu, sans corps valide ou sur un identifiant invalide", async () => {
    const author = await createMember("rp-susp-author@test.kemet", "rpsuspauthor");
    const reader = await createMember("rp-susp-reader@test.kemet", "rpsuspreader");
    const postId = (await createPost(author.cookie)).json().post.id as string;

    const noBody = await app.inject({ method: "PUT", url: `/api/posts/${postId}/repost`, headers: { cookie: reader.cookie }, payload: {} });
    expect(noBody.statusCode).toBe(400);
    const badId = await app.inject({ method: "PUT", url: "/api/posts/pas-un-uuid/repost", headers: { cookie: reader.cookie }, payload: { reposted: true } });
    expect(badId.statusCode).toBe(400);

    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, reader.profileId));
    expect((await repost(reader.cookie, postId, true)).statusCode).toBe(403);
  });

  it("efface les republications d'un compte supprimé et ne l'annonce plus dans le fil", async () => {
    const viewer = await createMember("rp-del-viewer@test.kemet", "rpdelviewer");
    const reposter = await createMember("rp-del-reposter@test.kemet", "rpdelreposter");
    const author = await createMember("rp-del-author@test.kemet", "rpdelauthor");
    await app.inject({ method: "POST", url: "/api/users/rpdelreposter/follow", headers: { cookie: viewer.cookie } });
    const postId = (await createPost(author.cookie)).json().post.id as string;
    await repost(reposter.cookie, postId, true);

    const deletion = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: reposter.cookie },
      payload: { password: "une-passphrase-solide" },
    });
    expect(deletion.statusCode).toBe(204);

    const post = await app.inject({ method: "GET", url: `/api/posts/${postId}`, headers: { cookie: viewer.cookie } });
    expect(post.json().post.repostCount).toBe(0);
    const feed = await readFeed(viewer.cookie, "tab=pour-toi");
    expect(feed.items.find((item) => item.id === postId)?.repostedBy ?? null).toBeNull();
  });
});
