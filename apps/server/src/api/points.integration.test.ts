import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, pointsLedger, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Points et niveaux (base Postgres réelle)", () => {
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

  async function createQuestionWithReply(authorCookie: string, replierCookie: string): Promise<{ postId: string; replyId: string }> {
    const post = await app.inject({
      method: "POST",
      url: "/api/posts",
      headers: { cookie: authorCookie },
      payload: { body: "Une question ?", format: "question" },
    });
    const postId = post.json().post.id as string;
    const reply = await app.inject({
      method: "POST",
      url: `/api/posts/${postId}/replies`,
      headers: { cookie: replierCookie },
      payload: { body: "Voici la réponse." },
    });
    return { postId, replyId: reply.json().reply.id as string };
  }

  async function markSolution(authorCookie: string, replyId: string) {
    return app.inject({
      method: "PUT",
      url: `/api/post-replies/${replyId}/solution`,
      headers: { cookie: authorCookie },
      payload: { isSolution: true },
    });
  }

  async function getPoints(cookie: string): Promise<number> {
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    return me.json().points as number;
  }

  it("plafonne les points qu'une même personne peut donner à une autre en un jour", async () => {
    const author = await createMember("cap-author@test.kemet", "capauthor");
    const replier = await createMember("cap-replier@test.kemet", "capreplier");

    // Six questions d'affilée dépassent la limite anti-spam réduite d'un
    // compte flambant neuf (lot 11, apps/server/src/moderation/) : l'auteur
    // est vieilli pour tester le plafond de points, pas l'anti-spam, déjà
    // couvert par ses propres tests.
    await db.update(profiles).set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }).where(eq(profiles.id, author.profileId));

    // Plafond à 50, +10 par solution marquée : la 6e des 6 questions ne
    // devrait plus rien apporter.
    for (let i = 0; i < 6; i++) {
      const { replyId } = await createQuestionWithReply(author.cookie, replier.cookie);
      const response = await markSolution(author.cookie, replyId);
      expect(response.statusCode).toBe(200);
    }

    // Plafonné à 50 sur l'entraide, +5 de régularité (jour actif).
    expect(await getPoints(replier.cookie)).toBe(55);
  });

  it("résiste à des requêtes concurrentes qui tentent de dépasser le plafond quotidien", async () => {
    const author = await createMember("concurrent-author@test.kemet", "concurrentauthor");
    const replier = await createMember("concurrent-replier@test.kemet", "concurrentreplier");

    // Même raison que le test précédent : l'auteur publie six questions, au-delà
    // de la limite anti-spam d'un compte flambant neuf.
    await db.update(profiles).set({ createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) }).where(eq(profiles.id, author.profileId));

    const replies = await Promise.all(
      Array.from({ length: 6 }, () => createQuestionWithReply(author.cookie, replier.cookie)),
    );
    await Promise.all(replies.map(({ replyId }) => markSolution(author.cookie, replyId)));

    // Sans verrou autour de la lecture puis l'écriture du plafond, ces six
    // requêtes simultanées (deux comptes complices scriptant une rafale de
    // gains) dépasseraient 50 au lieu de s'y arrêter (+5 de régularité en plus).
    expect(await getPoints(replier.cookie)).toBe(55);
  });

  it("un auteur ne peut pas se donner des points en marquant sa propre réponse comme solution", async () => {
    const author = await createMember("self-solution@test.kemet", "selfsolution");
    const { replyId } = await createQuestionWithReply(author.cookie, author.cookie);

    const response = await markSolution(author.cookie, replyId);
    expect(response.statusCode).toBe(200);
    expect(response.json().reply.isSolution).toBe(true);
    expect(await getPoints(author.cookie)).toBe(0);
  });

  it("n'expose le total de points que sur son propre profil, jamais sur le profil public", async () => {
    const member = await createMember("public-level@test.kemet", "publiclevel");
    const other = await createMember("public-viewer@test.kemet", "publicviewer");
    const { replyId } = await createQuestionWithReply(member.cookie, other.cookie);
    await markSolution(member.cookie, replyId);

    const publicProfile = await app.inject({ method: "GET", url: "/api/users/publicviewer", headers: { cookie: member.cookie } });
    expect(publicProfile.json().profile.level).toBe("apprenti");
    expect(publicProfile.json()).not.toHaveProperty("points");
    expect(publicProfile.json().profile).not.toHaveProperty("points");
  });

  it("ajoute un bonus de régularité calculé à partir des jours actifs du registre, jamais stocké", async () => {
    const member = await createMember("regularite@test.kemet", "regularite");

    // Un jour actif ancien (hors des 90 jours) ne compte pas.
    await db.insert(pointsLedger).values({
      profileId: member.profileId,
      source: "post_feedback_given",
      sourceId: crypto.randomUUID(),
      amount: 10,
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    });
    // Un jour actif dans la fenêtre de 90 jours compte, en plus d'aujourd'hui.
    await db.insert(pointsLedger).values({
      profileId: member.profileId,
      source: "post_feedback_given",
      sourceId: crypto.randomUUID(),
      amount: 10,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    const other = await createMember("regularite-other@test.kemet", "regulariteother");
    const { replyId } = await createQuestionWithReply(other.cookie, member.cookie);
    await markSolution(other.cookie, replyId);

    // Entraide : 10 (ancien) + 10 (dans la fenêtre) + 10 (solution) = 30.
    // Régularité : 2 jours actifs dans les 90 derniers jours (le jour à
    // -10 jours et aujourd'hui, pas celui à -120 jours) à 5 points = 10.
    expect(await getPoints(member.cookie)).toBe(40);
  });
});
