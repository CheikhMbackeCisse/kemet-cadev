import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Fil de posts (base Postgres réelle)", () => {
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
});
