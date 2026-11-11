import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { createDb, opportunities, profiles, type Db } from "@kemet/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";

const databaseUrl = getTestDatabaseUrl();
const PASSWORD = "une-passphrase-solide";

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const jobOffer = {
  slug: "dev-backend-dakar",
  kind: "job",
  title: "Développeuse ou développeur backend Node.js",
  organization: "Baobab Logistique",
  remote: false,
  countryCode: "SN",
  city: "Dakar",
  domains: ["backend"],
  description: "Nous cherchons une personne pour reprendre notre API de suivi de livraisons.",
  contractType: "cdi",
  startDate: isoDateInDays(30),
  compensationFcfa: 900000,
  budgetMinFcfa: null,
  budgetMaxFcfa: null,
  deadline: null,
  criteria: [],
};

const missionOffer = {
  slug: "erp-distribution-thies",
  kind: "mission",
  title: "ERP pour une PME de distribution",
  organization: "Distribution Ndiaye et Fils",
  remote: false,
  countryCode: "SN",
  city: "Thiès",
  domains: ["web", "data"],
  description: "Stocks, ventes et facturation pour trois dépôts, avec un accès sur téléphone.",
  contractType: null,
  startDate: null,
  compensationFcfa: null,
  budgetMinFcfa: 3000000,
  budgetMaxFcfa: 6000000,
  deadline: isoDateInDays(20),
  criteria: ["Une référence d'ERP livrée", "Disponible à Thiès une fois par semaine"],
};

describe.skipIf(!databaseUrl)("Opportunités (base Postgres réelle)", () => {
  let app: ReturnType<typeof buildApp>;
  let emailSender: InMemoryEmailSender;
  let db: Db;

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
    // Les comptes du test ont tous moins d'une minute : sans ce facteur, la
    // limite des comptes neufs bloquerait la deuxième publication.
    app = buildApp({
      db,
      auth,
      antiSpamConfig: { newAccountWindowHours: 24, newAccountFactor: 1, anonymousIpFactor: 3 },
    });
  });

  afterEach(async () => {
    await db.$client.end();
  });

  async function createMember(email: string, handle: string): Promise<{ cookie: string; profileId: string }> {
    await app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: { email, password: PASSWORD, name: handle } });
    const [message] = emailSender.findByRecipient(email);
    const verificationUrl = new URL(message!.html.match(/href="([^"]+)"/)![1]!);
    await app.inject({ method: "GET", url: verificationUrl.pathname + verificationUrl.search });
    const signIn = await app.inject({ method: "POST", url: "/api/auth/sign-in/email", payload: { email, password: PASSWORD } });
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

  function publish(cookie: string, payload: Record<string, unknown>) {
    return app.inject({ method: "POST", url: "/api/opportunities", headers: { cookie }, payload });
  }

  function list(query = "") {
    return app.inject({ method: "GET", url: `/api/opportunities${query}` });
  }

  it("publie un emploi et une mission, lisibles sans compte", async () => {
    const author = await createMember("rh@test.kemet", "rh-baobab");
    expect((await publish(author.cookie, jobOffer)).statusCode).toBe(200);
    const mission = await publish(author.cookie, missionOffer);
    expect(mission.statusCode).toBe(200);
    expect(mission.json().opportunity).toMatchObject({ kind: "mission", closed: false, authorHandle: "rh-baobab" });

    const page = await list();
    expect(page.statusCode).toBe(200);
    expect(page.json().items.map((item: { slug: string }) => item.slug)).toEqual([
      "erp-distribution-thies",
      "dev-backend-dakar",
    ]);

    const detail = await app.inject({ method: "GET", url: "/api/opportunities/erp-distribution-thies" });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().opportunity.criteria).toHaveLength(2);
  });

  it("refuse une publication sans compte, d'un compte suspendu, ou incohérente avec son type", async () => {
    const visitor = await app.inject({ method: "POST", url: "/api/opportunities", payload: jobOffer });
    expect(visitor.statusCode).toBe(401);

    const author = await createMember("incoherent@test.kemet", "incoherent");
    const missionWithoutBudget = await publish(author.cookie, { ...missionOffer, budgetMinFcfa: null });
    expect(missionWithoutBudget.statusCode).toBe(400);
    const reversedBudget = await publish(author.cookie, { ...missionOffer, budgetMinFcfa: 9000000 });
    expect(reversedBudget.statusCode).toBe(400);
    const jobWithBudget = await publish(author.cookie, { ...jobOffer, budgetMinFcfa: 1, budgetMaxFcfa: 2 });
    expect(jobWithBudget.statusCode).toBe(400);
    const outsideAfrica = await publish(author.cookie, { ...jobOffer, countryCode: "FR" });
    expect(outsideAfrica.statusCode).toBe(400);
    const nowhere = await publish(author.cookie, { ...jobOffer, countryCode: null, remote: false });
    expect(nowhere.statusCode).toBe(400);
    const reservedSlug = await publish(author.cookie, { ...jobOffer, slug: "nouvelle" });
    expect(reservedSlug.statusCode).toBe(400);

    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, author.profileId));
    const suspended = await publish(author.cookie, jobOffer);
    expect(suspended.statusCode).toBe(403);
  });

  it("refuse un identifiant déjà pris", async () => {
    const author = await createMember("doublon@test.kemet", "doublon");
    expect((await publish(author.cookie, jobOffer)).statusCode).toBe(200);
    expect((await publish(author.cookie, jobOffer)).statusCode).toBe(409);
  });

  it("laisse seulement l'auteur modifier ou supprimer son offre", async () => {
    const author = await createMember("auteur@test.kemet", "auteur-offre");
    const other = await createMember("autre@test.kemet", "autre-compte");
    await publish(author.cookie, jobOffer);
    const { slug, ...input } = jobOffer;
    const changed = { ...input, title: "Développeuse ou développeur backend senior" };

    const byOther = await app.inject({
      method: "PUT",
      url: `/api/opportunities/${slug}`,
      headers: { cookie: other.cookie },
      payload: changed,
    });
    expect(byOther.statusCode).toBe(403);
    const removeByOther = await app.inject({
      method: "DELETE",
      url: "/api/opportunities/dev-backend-dakar",
      headers: { cookie: other.cookie },
    });
    expect(removeByOther.statusCode).toBe(403);

    const byAuthor = await app.inject({
      method: "PUT",
      url: "/api/opportunities/dev-backend-dakar",
      headers: { cookie: author.cookie },
      payload: changed,
    });
    expect(byAuthor.statusCode).toBe(200);
    expect(byAuthor.json().opportunity.title).toBe(changed.title);

    const removed = await app.inject({
      method: "DELETE",
      url: "/api/opportunities/dev-backend-dakar",
      headers: { cookie: author.cookie },
    });
    expect(removed.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/opportunities/dev-backend-dakar" })).statusCode).toBe(404);
  });

  it("refuse la modification et la suppression sans compte, et retire les offres d'un compte suspendu", async () => {
    const author = await createMember("suspendu@test.kemet", "suspendu");
    await publish(author.cookie, jobOffer);
    const { slug, ...input } = jobOffer;
    const url = `/api/opportunities/${slug}`;

    expect((await app.inject({ method: "PUT", url, payload: input })).statusCode).toBe(401);
    expect((await app.inject({ method: "DELETE", url })).statusCode).toBe(401);

    await db.update(profiles).set({ suspendedAt: new Date() }).where(eq(profiles.id, author.profileId));
    const update = await app.inject({ method: "PUT", url, headers: { cookie: author.cookie }, payload: input });
    expect(update.statusCode).toBe(403);
    const remove = await app.inject({ method: "DELETE", url, headers: { cookie: author.cookie } });
    expect(remove.statusCode).toBe(403);
    expect((await list()).json().items).toHaveLength(0);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);

    await db.update(profiles).set({ suspendedAt: null }).where(eq(profiles.id, author.profileId));
    expect((await list()).json().items).toHaveLength(1);
  });

  it("filtre par auteur et ne montre jamais l'offre d'un figurant", async () => {
    const first = await createMember("premier@test.kemet", "premier-auteur");
    const second = await createMember("second@test.kemet", "second-auteur");
    await publish(first.cookie, jobOffer);
    await publish(second.cookie, missionOffer);

    const slugs = async (query: string) =>
      (await list(query)).json().items.map((item: { slug: string }) => item.slug);
    expect(await slugs("?author=premier-auteur")).toEqual([jobOffer.slug]);

    await db.update(profiles).set({ isFiller: true }).where(eq(profiles.id, second.profileId));
    expect(await slugs("")).toEqual([jobOffer.slug]);
    expect(await slugs("?author=second-auteur")).toEqual([]);
    const detail = await app.inject({ method: "GET", url: `/api/opportunities/${missionOffer.slug}` });
    expect(detail.statusCode).toBe(404);
  });

  it("laisse signaler une offre et la masquer par la modération", async () => {
    const author = await createMember("arnaque@test.kemet", "fausse-offre");
    const reporter = await createMember("vigilant@test.kemet", "vigilant");
    const admin = await createMember("moderation@test.kemet", "moderation");
    await db.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, admin.profileId));
    const opportunityId = (await publish(author.cookie, jobOffer)).json().opportunity.id as string;
    const report = (cookie: string) =>
      app.inject({
        method: "POST",
        url: "/api/reports",
        headers: { cookie },
        payload: { targetType: "opportunity", targetId: opportunityId, reason: "Demande des frais de dossier." },
      });

    expect((await report(author.cookie)).statusCode).toBe(400);
    const created = await report(reporter.cookie);
    expect(created.statusCode).toBe(200);
    expect(created.json().report.targetSummary).toBe(jobOffer.title);

    const queue = await app.inject({ method: "GET", url: "/api/reports", headers: { cookie: admin.cookie } });
    expect(queue.json().items).toHaveLength(1);
    const resolved = await app.inject({
      method: "PUT",
      url: `/api/reports/${created.json().report.id}/resolve`,
      headers: { cookie: admin.cookie },
      payload: { action: "hide" },
    });
    expect(resolved.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/opportunities/${jobOffer.slug}` })).statusCode).toBe(404);
    expect((await list()).json().items).toHaveLength(0);
  });

  it("refuse une date impossible et un curseur mal formé", async () => {
    const author = await createMember("dates@test.kemet", "dates");
    expect((await publish(author.cookie, { ...jobOffer, startDate: "2027-02-31" })).statusCode).toBe(400);
    expect((await publish(author.cookie, { ...jobOffer, startDate: "0000-01-01" })).statusCode).toBe(400);
    expect((await list("?cursor=2026-11-01")).statusCode).toBe(400);
  });

  it("filtre par type, pays et domaine", async () => {
    const author = await createMember("filtres@test.kemet", "filtres");
    await publish(author.cookie, jobOffer);
    await publish(author.cookie, missionOffer);
    await publish(author.cookie, {
      ...jobOffer,
      slug: "stage-mobile-abidjan",
      kind: "internship",
      title: "Stage développement mobile Flutter",
      countryCode: "CI",
      city: "Abidjan",
      domains: ["mobile"],
      contractType: "stage",
      compensationFcfa: null,
    });

    const slugs = async (query: string) =>
      (await list(query)).json().items.map((item: { slug: string }) => item.slug);
    expect(await slugs("?kind=internship")).toEqual(["stage-mobile-abidjan"]);
    expect(await slugs("?country=CI")).toEqual(["stage-mobile-abidjan"]);
    expect(await slugs("?domain=data")).toEqual(["erp-distribution-thies"]);
    expect(await slugs("?kind=mission&country=CI")).toEqual([]);
    expect((await list("?domain=cuisine")).statusCode).toBe(400);
  });

  it("sort une offre clôturée de la liste par défaut et la marque Clôturée", async () => {
    const author = await createMember("cloture@test.kemet", "cloture");
    await publish(author.cookie, missionOffer);
    await db
      .update(opportunities)
      .set({ deadline: isoDateInDays(-1) })
      .where(eq(opportunities.slug, missionOffer.slug));

    expect((await list()).json().items).toHaveLength(0);
    const withClosed = (await list("?includeClosed=true")).json().items;
    expect(withClosed).toHaveLength(1);
    expect(withClosed[0].closed).toBe(true);
    const detail = await app.inject({ method: "GET", url: `/api/opportunities/${missionOffer.slug}` });
    expect(detail.json().opportunity.closed).toBe(true);
  });

  it("pagine sans perdre d'offre", async () => {
    const author = await createMember("pages@test.kemet", "pages");
    for (let index = 0; index < 5; index += 1) {
      await publish(author.cookie, { ...jobOffer, slug: `offre-${index}` });
    }
    // Même instant pour toutes : seul l'identifiant les départage en bord de page.
    await db.update(opportunities).set({ createdAt: new Date("2026-11-01T10:00:00.000Z") });
    const first = (await list("?limit=2")).json();
    expect(first.items).toHaveLength(2);
    const seen = [...first.items];
    let cursor: string | null = first.nextCursor;
    while (cursor) {
      const page = (await list(`?limit=2&cursor=${encodeURIComponent(cursor)}`)).json();
      seen.push(...page.items);
      cursor = page.nextCursor;
    }
    expect(new Set(seen.map((item: { slug: string }) => item.slug)).size).toBe(5);
  });

  it("efface les offres d'un compte supprimé", async () => {
    const author = await createMember("supprime@test.kemet", "supprime");
    await publish(author.cookie, jobOffer);
    const deletion = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: author.cookie },
      payload: { password: PASSWORD },
    });
    expect(deletion.statusCode).toBe(204);
    expect(await db.select().from(opportunities)).toHaveLength(0);
  });
});
