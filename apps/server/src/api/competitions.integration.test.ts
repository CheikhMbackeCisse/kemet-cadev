import { eq } from "drizzle-orm";
import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { competitions, createDb, pointsLedger, profiles, type Db } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Compétitions (base Postgres réelle)", () => {
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
    const me = await app.inject({ method: "PATCH", url: "/api/me/profile", headers: { cookie }, payload: { handle, displayName: handle, country: "SN" } });
    return { cookie, profileId: me.json().profile.id as string };
  }

  async function makeAdmin(profileId: string): Promise<void> {
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, profileId));
  }

  /** Fait passer un profil au niveau Architecte sans rejouer tout le parcours de points. */
  async function makeArchitecte(profileId: string): Promise<void> {
    await db.insert(pointsLedger).values({ profileId, source: "project_help_confirmed", sourceId: profileId, amount: 2500 });
  }

  async function requestCompetition(cookie: string, overrides: Partial<Record<string, unknown>> = {}) {
    const now = Date.now();
    return app.inject({
      method: "POST",
      url: "/api/competitions",
      headers: { cookie },
      payload: {
        slug: "cadev-test",
        name: "Défi de test",
        pitch: "Une compétition créée pour les tests d'intégration des compétitions.",
        registrationClosesAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        submissionClosesAt: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
        votingClosesAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
      },
    });
  }

  /**
   * Fait avancer la phase d'une compétition en reculant une échéance dans le
   * passé plutôt qu'en attendant réellement : la phase se dérive toujours de
   * l'instant présent (computeCompetitionPhase), jamais stockée.
   */
  async function closePhase(competitionId: string, column: "registrationClosesAt" | "submissionClosesAt" | "votingClosesAt"): Promise<void> {
    await db.update(competitions).set({ [column]: new Date(Date.now() - 1000) }).where(eq(competitions.id, competitionId));
  }

  async function createProject(cookie: string, overrides: Partial<Record<string, unknown>> = {}) {
    return app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie },
      payload: {
        slug: "projet-competition",
        name: "Projet de compétition",
        pitch: "Un projet soumis à une compétition pour les tests d'intégration.",
        repoUrl: "https://github.com/exemple/projet-competition",
        ...overrides,
      },
    });
  }

  it("une demande de compétition attend une validation admin avant publication", async () => {
    const creator = await createMember("creator@test.kemet", "creator");
    const other = await createMember("other@test.kemet", "other");
    const admin = await createMember("admin@test.kemet", "admin");
    await makeAdmin(admin.profileId);

    const created = await requestCompetition(creator.cookie);
    expect(created.statusCode).toBe(200);
    expect(created.json().competition.status).toBe("pending_review");

    const competitionId = created.json().competition.id as string;

    const deniedReview = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/review`,
      headers: { cookie: other.cookie },
      payload: { approve: true },
    });
    expect(deniedReview.statusCode).toBe(403);

    const approved = await app.inject({
      method: "PUT",
      url: `/api/competitions/${competitionId}/review`,
      headers: { cookie: admin.cookie },
      payload: { approve: true },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().competition.status).toBe("published");
  });

  it("une personne ne peut appartenir qu'à une seule équipe par compétition, et un nom d'équipe ne se répète pas", async () => {
    const admin = await createMember("admin2@test.kemet", "admin2");
    await makeAdmin(admin.profileId);
    const captain = await createMember("captain@test.kemet", "captain");
    const member = await createMember("member@test.kemet", "member");

    const created = await requestCompetition(captain.cookie, { slug: "cadev-teams" });
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });

    const team = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-teams/teams",
      headers: { cookie: captain.cookie },
      payload: { name: "Les Baobabs" },
    });
    expect(team.statusCode).toBe(200);
    const teamId = team.json().team.id as string;

    const secondTeamSameName = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-teams/teams",
      headers: { cookie: member.cookie },
      payload: { name: "Les Baobabs" },
    });
    expect(secondTeamSameName.statusCode).toBe(409);

    const join = await app.inject({ method: "POST", url: `/api/teams/${teamId}/join`, headers: { cookie: member.cookie } });
    expect(join.statusCode).toBe(200);
    expect(join.json().team.memberHandles).toEqual(expect.arrayContaining(["captain", "member"]));

    const secondJoin = await app.inject({ method: "POST", url: `/api/teams/${teamId}/join`, headers: { cookie: member.cookie } });
    expect(secondJoin.statusCode).toBe(409);

    const secondTeamByMember = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-teams/teams",
      headers: { cookie: member.cookie },
      payload: { name: "Autre équipe" },
    });
    expect(secondTeamByMember.statusCode).toBe(409);
  });

  it("seul le propriétaire du projet soumet, et une équipe ne soumet qu'une fois", async () => {
    const admin = await createMember("admin3@test.kemet", "admin3");
    await makeAdmin(admin.profileId);
    const captain = await createMember("captain2@test.kemet", "captain2");
    const outsider = await createMember("outsider@test.kemet", "outsider");

    const created = await requestCompetition(captain.cookie, { slug: "cadev-submit" });
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });
    await app.inject({ method: "POST", url: "/api/competitions/cadev-submit/teams", headers: { cookie: captain.cookie }, payload: { name: "Équipe" } });

    const project = await createProject(captain.cookie);
    const projectId = project.json().project.id as string;

    await closePhase(competitionId, "registrationClosesAt");

    const asOutsider = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-submit/submissions",
      headers: { cookie: outsider.cookie },
      payload: { projectId, title: "Titre", pitch: "Une présentation de dix caractères ou plus.", repoUrl: "https://github.com/exemple/x" },
    });
    expect(asOutsider.statusCode).toBe(403);

    const submission = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-submit/submissions",
      headers: { cookie: captain.cookie },
      payload: { projectId, title: "Titre", pitch: "Une présentation de dix caractères ou plus.", repoUrl: "https://github.com/exemple/x" },
    });
    expect(submission.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-submit/submissions",
      headers: { cookie: captain.cookie },
      payload: { projectId, title: "Autre", pitch: "Une présentation de dix caractères ou plus.", repoUrl: "https://github.com/exemple/y" },
    });
    expect(second.statusCode).toBe(409);

    const participation = await db.select().from(pointsLedger).where(eq(pointsLedger.source, "competition_participation"));
    expect(participation).toHaveLength(1);
    expect(participation[0]!.amount).toBe(10);
  });

  it("le vote et la notation du jury refusent l'auto-évaluation", async () => {
    const admin = await createMember("admin4@test.kemet", "admin4");
    await makeAdmin(admin.profileId);
    const captainA = await createMember("captaina@test.kemet", "captaina");
    const captainB = await createMember("captainb@test.kemet", "captainb");
    const juror = await createMember("juror@test.kemet", "juror");
    await makeArchitecte(juror.profileId);
    // Architecte elle aussi, pour vérifier que le blocage vient bien de
    // l'appartenance à l'équipe, pas d'un niveau insuffisant.
    await makeArchitecte(captainA.profileId);

    const created = await requestCompetition(captainA.cookie, { slug: "cadev-vote" });
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });

    await app.inject({ method: "POST", url: "/api/competitions/cadev-vote/teams", headers: { cookie: captainA.cookie }, payload: { name: "Équipe A" } });
    await app.inject({ method: "POST", url: "/api/competitions/cadev-vote/teams", headers: { cookie: captainB.cookie }, payload: { name: "Équipe B" } });

    const projectA = await createProject(captainA.cookie, { slug: "projet-a" });
    await closePhase(competitionId, "registrationClosesAt");
    const submissionA = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-vote/submissions",
      headers: { cookie: captainA.cookie },
      payload: {
        projectId: projectA.json().project.id,
        title: "Soumission A",
        pitch: "Une présentation de dix caractères ou plus.",
        repoUrl: "https://github.com/exemple/a",
      },
    });
    const submissionAId = submissionA.json().submission.id as string;

    await closePhase(competitionId, "submissionClosesAt");

    const selfVote = await app.inject({ method: "POST", url: `/api/submissions/${submissionAId}/vote`, headers: { cookie: captainA.cookie } });
    expect(selfVote.statusCode).toBe(403);

    const crossVote = await app.inject({ method: "POST", url: `/api/submissions/${submissionAId}/vote`, headers: { cookie: captainB.cookie } });
    expect(crossVote.statusCode).toBe(200);

    const nonJurorScore = await app.inject({
      method: "PUT",
      url: `/api/submissions/${submissionAId}/jury-score`,
      headers: { cookie: captainB.cookie },
      payload: { score: 15 },
    });
    expect(nonJurorScore.statusCode).toBe(403);

    const selfScore = await app.inject({
      method: "PUT",
      url: `/api/submissions/${submissionAId}/jury-score`,
      headers: { cookie: captainA.cookie },
      payload: { score: 15 },
    });
    expect(selfScore.statusCode).toBe(403);

    const jurorScore = await app.inject({
      method: "PUT",
      url: `/api/submissions/${submissionAId}/jury-score`,
      headers: { cookie: juror.cookie },
      payload: { score: 18 },
    });
    expect(jurorScore.statusCode).toBe(200);
    expect(jurorScore.json().score).toBe(18);
  });

  it("les résultats combinent jury et vote et versent les points de victoire une seule fois", async () => {
    const admin = await createMember("admin5@test.kemet", "admin5");
    await makeAdmin(admin.profileId);
    const captain = await createMember("captain5@test.kemet", "captain5");
    const voter = await createMember("voter5@test.kemet", "voter5");

    const created = await requestCompetition(captain.cookie, { slug: "cadev-results" });
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });
    await app.inject({ method: "POST", url: "/api/competitions/cadev-results/teams", headers: { cookie: captain.cookie }, payload: { name: "Équipe gagnante" } });

    const project = await createProject(captain.cookie, { slug: "projet-resultats" });
    await closePhase(competitionId, "registrationClosesAt");
    const submission = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-results/submissions",
      headers: { cookie: captain.cookie },
      payload: {
        projectId: project.json().project.id,
        title: "Soumission gagnante",
        pitch: "Une présentation de dix caractères ou plus.",
        repoUrl: "https://github.com/exemple/win",
      },
    });
    const submissionId = submission.json().submission.id as string;

    await closePhase(competitionId, "submissionClosesAt");
    await app.inject({ method: "POST", url: `/api/submissions/${submissionId}/vote`, headers: { cookie: voter.cookie } });

    const notYet = await app.inject({ method: "GET", url: "/api/competitions/cadev-results/results", headers: { cookie: captain.cookie } });
    expect(notYet.statusCode).toBe(400);

    await closePhase(competitionId, "votingClosesAt");

    const results = await app.inject({ method: "GET", url: "/api/competitions/cadev-results/results", headers: { cookie: captain.cookie } });
    expect(results.statusCode).toBe(200);
    const items = results.json().items as Array<{ submissionId: string; rank: number; voteCount: number }>;
    expect(items[0]!.submissionId).toBe(submissionId);
    expect(items[0]!.rank).toBe(1);
    expect(items[0]!.voteCount).toBe(1);

    await app.inject({ method: "GET", url: "/api/competitions/cadev-results/results", headers: { cookie: captain.cookie } });

    const victoryRows = await db.select().from(pointsLedger).where(eq(pointsLedger.source, "competition_victory"));
    expect(victoryRows).toHaveLength(1);
    expect(victoryRows[0]!.amount).toBe(200);
  });

  it("chaque action refuse de s'exécuter hors de sa fenêtre de phase", async () => {
    const admin = await createMember("admin6@test.kemet", "admin6");
    await makeAdmin(admin.profileId);
    const captain = await createMember("captain6@test.kemet", "captain6");
    const latecomer = await createMember("latecomer@test.kemet", "latecomer");

    const created = await requestCompetition(captain.cookie, { slug: "cadev-phases" });
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });
    const team = await app.inject({ method: "POST", url: "/api/competitions/cadev-phases/teams", headers: { cookie: captain.cookie }, payload: { name: "Équipe" } });
    const teamId = team.json().team.id as string;

    await closePhase(competitionId, "registrationClosesAt");

    const lateJoin = await app.inject({ method: "POST", url: `/api/teams/${teamId}/join`, headers: { cookie: latecomer.cookie } });
    expect(lateJoin.statusCode).toBe(400);

    const project = await createProject(captain.cookie, { slug: "projet-phases" });
    const submission = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-phases/submissions",
      headers: { cookie: captain.cookie },
      payload: {
        projectId: project.json().project.id,
        title: "Soumission",
        pitch: "Une présentation de dix caractères ou plus.",
        repoUrl: "https://github.com/exemple/phases",
      },
    });
    const submissionId = submission.json().submission.id as string;

    const earlyVote = await app.inject({ method: "POST", url: `/api/submissions/${submissionId}/vote`, headers: { cookie: latecomer.cookie } });
    expect(earlyVote.statusCode).toBe(400);

    await closePhase(competitionId, "submissionClosesAt");

    const lateSubmission = await app.inject({
      method: "POST",
      url: "/api/competitions/cadev-phases/submissions",
      headers: { cookie: captain.cookie },
      payload: {
        projectId: project.json().project.id,
        title: "Autre",
        pitch: "Une présentation de dix caractères ou plus.",
        repoUrl: "https://github.com/exemple/phases2",
      },
    });
    expect(lateSubmission.statusCode).toBe(400);
  });

  it("un visiteur lit les compétitions publiées et leurs équipes, jamais une demande en attente", async () => {
    const creator = await createMember("creator-visitor@test.kemet", "creatorvisitor");
    const admin = await createMember("admin-visitor@test.kemet", "adminvisitor");
    await makeAdmin(admin.profileId);
    const pending = await requestCompetition(creator.cookie, { slug: "en-attente" });
    expect(pending.statusCode).toBe(200);
    const created = await requestCompetition(creator.cookie);
    const competitionId = created.json().competition.id as string;
    await app.inject({ method: "PUT", url: `/api/competitions/${competitionId}/review`, headers: { cookie: admin.cookie }, payload: { approve: true } });

    const list = await app.inject({ method: "GET", url: "/api/competitions" });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.map((item: { slug: string }) => item.slug)).toEqual(["cadev-test"]);

    const detail = await app.inject({ method: "GET", url: "/api/competitions/cadev-test" });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().competition.viewerIsCreator).toBe(false);
    expect(detail.json().competition.reviewNote).toBeNull();
    const hidden = await app.inject({ method: "GET", url: "/api/competitions/en-attente" });
    expect(hidden.statusCode).toBe(404);

    const teams = await app.inject({ method: "GET", url: "/api/competitions/cadev-test/teams" });
    expect(teams.statusCode).toBe(200);
    const submissions = await app.inject({ method: "GET", url: "/api/competitions/cadev-test/submissions" });
    expect(submissions.statusCode).toBe(200);

    const join = await app.inject({ method: "POST", url: "/api/competitions/cadev-test/teams", payload: { name: "Équipe visiteur" } });
    expect(join.statusCode).toBe(401);
    const myVote = await app.inject({ method: "GET", url: "/api/competitions/cadev-test/my-vote" });
    expect(myVote.statusCode).toBe(401);
  });
});
