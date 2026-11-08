import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb } from "@kemet/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("Projets (base Postgres réelle)", () => {
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

  async function createProject(cookie: string, overrides: Partial<Record<string, unknown>> = {}) {
    return app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { cookie },
      payload: {
        slug: "projet-test",
        name: "Projet de test",
        pitch: "Un projet créé pour les tests d'intégration des projets.",
        repoUrl: "https://github.com/exemple/projet-test",
        ...overrides,
      },
    });
  }

  it("refuse de créer deux projets avec le même identifiant", async () => {
    const owner = await createMember("owner-a@test.kemet", "ownera");
    const first = await createProject(owner.cookie);
    expect(first.statusCode).toBe(200);

    const second = await createProject(owner.cookie);
    expect(second.statusCode).toBe(409);
  });

  it("refuse de modifier ou supprimer le projet d'un autre", async () => {
    const owner = await createMember("owner-b@test.kemet", "ownerb");
    const other = await createMember("owner-b-other@test.kemet", "ownerbother");
    await createProject(owner.cookie);

    const patch = await app.inject({
      method: "PATCH",
      url: "/api/projects/projet-test",
      headers: { cookie: other.cookie },
      payload: { name: "Renommé" },
    });
    expect(patch.statusCode).toBe(403);

    const remove = await app.inject({ method: "DELETE", url: "/api/projects/projet-test", headers: { cookie: other.cookie } });
    expect(remove.statusCode).toBe(403);
  });

  it("seul le propriétaire du projet peut publier une demande d'aide", async () => {
    const owner = await createMember("owner-c@test.kemet", "ownerc");
    const other = await createMember("owner-c-other@test.kemet", "ownercother");
    await createProject(owner.cookie);

    const asOther = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: other.cookie },
      payload: { title: "Cherche un relecteur", description: "Je cherche un regard sur ce module avant de le publier." },
    });
    expect(asOther.statusCode).toBe(403);

    const asOwner = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un relecteur", description: "Je cherche un regard sur ce module avant de le publier." },
    });
    expect(asOwner.statusCode).toBe(200);
    expect(asOwner.json().helpRequest.status).toBe("open");
  });

  it("seul le propriétaire du projet peut fermer une demande d'aide", async () => {
    const owner = await createMember("close-owner@test.kemet", "closeowner");
    const other = await createMember("close-other@test.kemet", "closeother");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un relecteur", description: "Je cherche un regard sur ce module avant de le publier." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;

    const asOther = await app.inject({ method: "PUT", url: `/api/help-requests/${helpRequestId}/close`, headers: { cookie: other.cookie } });
    expect(asOther.statusCode).toBe(403);

    const asOwner = await app.inject({ method: "PUT", url: `/api/help-requests/${helpRequestId}/close`, headers: { cookie: owner.cookie } });
    expect(asOwner.statusCode).toBe(200);
    expect(asOwner.json().helpRequest.status).toBe("closed");
  });

  it("seul le propriétaire du projet peut décider d'une candidature", async () => {
    const owner = await createMember("decide-owner-auth@test.kemet", "decideownerauth");
    const applicant = await createMember("decide-applicant-auth@test.kemet", "decideapplicantauth");
    const stranger = await createMember("decide-stranger-auth@test.kemet", "decidestrangerauth");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un dev", description: "Besoin d'un coup de main sur l'API." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;
    const application = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: applicant.cookie },
      payload: { message: "Je peux aider sur ce point rapidement." },
    });
    const applicationId = application.json().application.id as string;

    const asStranger = await app.inject({
      method: "PUT",
      url: `/api/applications/${applicationId}/decision`,
      headers: { cookie: stranger.cookie },
      payload: { accepted: true },
    });
    expect(asStranger.statusCode).toBe(403);

    const asApplicant = await app.inject({
      method: "PUT",
      url: `/api/applications/${applicationId}/decision`,
      headers: { cookie: applicant.cookie },
      payload: { accepted: true },
    });
    expect(asApplicant.statusCode).toBe(403);
  });

  it("une personne ne postule qu'une fois à la même demande, jamais à la sienne", async () => {
    const owner = await createMember("help-owner@test.kemet", "helpowner");
    const applicant = await createMember("help-applicant@test.kemet", "helpapplicant");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un dev front", description: "Besoin d'un coup de main sur l'interface du tableau de bord." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;

    const ownApplication = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: owner.cookie },
      payload: { message: "Je postule à ma propre demande, ce qui n'est pas permis." },
    });
    expect(ownApplication.statusCode).toBe(400);

    const first = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: applicant.cookie },
      payload: { message: "J'ai de l'expérience en React et je peux aider rapidement." },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: applicant.cookie },
      payload: { message: "Je retente ma chance, même demande." },
    });
    expect(second.statusCode).toBe(409);
  });

  it("accepter une candidature verse 20 points au candidat accepté (+5 de régularité), rien au refusé", async () => {
    const owner = await createMember("award-owner@test.kemet", "awardowner");
    const chosen = await createMember("award-chosen@test.kemet", "awardchosen");
    const rejected = await createMember("award-rejected@test.kemet", "awardrejected");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un collaborateur", kind: "collaboration", description: "Je cherche quelqu'un pour la suite du projet." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;

    const chosenApplication = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: chosen.cookie },
      payload: { message: "Je suis disponible et motivé pour rejoindre ce projet." },
    });
    const rejectedApplication = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: rejected.cookie },
      payload: { message: "Je suis aussi intéressé pour rejoindre ce projet." },
    });

    // Accepter une candidature refuse les autres en attente.
    await app.inject({
      method: "PUT",
      url: `/api/applications/${chosenApplication.json().application.id}/decision`,
      headers: { cookie: owner.cookie },
      payload: { accepted: true },
    });
    void rejectedApplication;

    const chosenMe = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: chosen.cookie } });
    const rejectedMe = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: rejected.cookie } });
    // Entraide : 20 (aide confirmée). Régularité : 1 jour actif à 5 points.
    expect(chosenMe.json().points).toBe(25);
    expect(rejectedMe.json().points).toBe(0);
  });

  it("accepter une candidature ferme la demande et refuse les autres candidatures en attente", async () => {
    const owner = await createMember("decide-owner@test.kemet", "decideowner");
    const chosen = await createMember("decide-chosen@test.kemet", "decidechosen");
    const rejected = await createMember("decide-rejected@test.kemet", "deciderejected");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un collaborateur", kind: "collaboration", description: "Je cherche quelqu'un pour la suite du projet." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;

    const chosenApplication = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: chosen.cookie },
      payload: { message: "Je suis disponible et motivé pour rejoindre ce projet." },
    });
    const rejectedApplication = await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: rejected.cookie },
      payload: { message: "Je suis aussi intéressé pour rejoindre ce projet." },
    });
    const chosenId = chosenApplication.json().application.id as string;
    const rejectedId = rejectedApplication.json().application.id as string;

    const decision = await app.inject({
      method: "PUT",
      url: `/api/applications/${chosenId}/decision`,
      headers: { cookie: owner.cookie },
      payload: { accepted: true },
    });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().application.status).toBe("accepted");

    const applications = await app.inject({
      method: "GET",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: owner.cookie },
    });
    const byId = new Map((applications.json().items as { id: string; status: string }[]).map((item) => [item.id, item.status]));
    expect(byId.get(chosenId)).toBe("accepted");
    expect(byId.get(rejectedId)).toBe("declined");
  });

  it("les candidatures restent invisibles à qui n'est pas le propriétaire du projet", async () => {
    const owner = await createMember("privacy-owner@test.kemet", "privacyowner");
    const applicant = await createMember("privacy-applicant@test.kemet", "privacyapplicant");
    const stranger = await createMember("privacy-stranger@test.kemet", "privacystranger");
    await createProject(owner.cookie);
    const helpRequest = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Cherche un testeur", description: "Besoin d'un retour sur la nouvelle version avant publication." },
    });
    const helpRequestId = helpRequest.json().helpRequest.id as string;
    await app.inject({
      method: "POST",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: applicant.cookie },
      payload: { message: "Je peux tester cette version dès aujourd'hui." },
    });

    const asStranger = await app.inject({
      method: "GET",
      url: `/api/help-requests/${helpRequestId}/applications`,
      headers: { cookie: stranger.cookie },
    });
    expect(asStranger.statusCode).toBe(403);
  });

  it("un visiteur lit les projets et leurs demandes, mais n'écrit rien et ne voit aucune candidature", async () => {
    const owner = await createMember("owner-visitor@test.kemet", "ownervisitor");
    await createProject(owner.cookie);
    const published = await app.inject({
      method: "POST",
      url: "/api/projects/projet-test/help-requests",
      headers: { cookie: owner.cookie },
      payload: { title: "Relire mon schéma", description: "Un regard extérieur sur le schéma de la base avant de publier." },
    });
    const helpRequestId = published.json().helpRequest.id as string;

    const list = await app.inject({ method: "GET", url: "/api/projects" });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    const detail = await app.inject({ method: "GET", url: "/api/projects/projet-test" });
    expect(detail.statusCode).toBe(200);
    const helpRequests = await app.inject({ method: "GET", url: "/api/projects/projet-test/help-requests" });
    expect(helpRequests.statusCode).toBe(200);
    expect(helpRequests.json().items).toHaveLength(1);

    const applications = await app.inject({ method: "GET", url: `/api/help-requests/${helpRequestId}/applications` });
    expect(applications.statusCode).toBe(401);
    const apply = await app.inject({ method: "POST", url: `/api/help-requests/${helpRequestId}/applications`, payload: { message: "Je peux aider." } });
    expect(apply.statusCode).toBe(401);
    const create = await app.inject({ method: "POST", url: "/api/projects", payload: { slug: "x", name: "X", pitch: "Un pitch assez long pour passer." } });
    expect(create.statusCode).toBe(401);
  });
});
