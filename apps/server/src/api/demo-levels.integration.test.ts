import { getTestDatabaseUrl, resetTestDatabase } from "@kemet/db/testing";
import { seedDemoDataset } from "@kemet/db/demo-seed";
import { createDb, juryScores, pointsLedger, profiles, user, type Db } from "@kemet/db";
import { isLevelAtLeast } from "@kemet/shared";
import { and, eq, like, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "../auth/auth.js";
import { InMemoryEmailSender } from "../email/in-memory-email-sender.js";
import { buildApp } from "./app.js";
import { computeProfilesPoints } from "./repositories/points.js";

const databaseUrl = getTestDatabaseUrl();

describe.skipIf(!databaseUrl)("niveaux des comptes de démonstration (base Postgres réelle)", () => {
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let levels: Map<string, string>;
  let namedAccounts: { id: string; handle: string; openToOpportunities: boolean }[];

  beforeAll(async () => {
    await resetTestDatabase(databaseUrl!);
    db = createDb(databaseUrl!);
    await seedDemoDataset(db);
    const auth = createAuth({
      db,
      emailSender: new InMemoryEmailSender(),
      baseUrl: "http://localhost:3001",
      webAppUrl: "http://localhost:5173",
      secret: "test-secret-at-least-32-characters-long",
      rateLimitEnabled: false,
    });
    app = buildApp({ db, auth });

    namedAccounts = await db
      .select({ id: profiles.id, handle: profiles.handle, openToOpportunities: profiles.openToOpportunities })
      .from(profiles)
      .innerJoin(user, eq(user.id, profiles.userId))
      .where(and(eq(profiles.isDemo, true), like(user.email, "%.%@demo.kemet.africa")));
    const points = await computeProfilesPoints(db, namedAccounts.map((account) => account.id));
    levels = new Map(namedAccounts.map((account) => [account.handle, points.get(account.id)!.level]));
  }, 180_000);

  it("couvre plusieurs niveaux, dont un Architecte et un Scribe", () => {
    expect(namedAccounts).toHaveLength(10);
    expect(levels.get("amina-diallo")).toBe("architecte");
    expect(levels.get("samuel-mwangi")).toBe("scribe");
    expect(new Set(levels.values())).toEqual(new Set(["apprenti", "artisan", "scribe", "architecte"]));
  });

  it("ne montre « Ouvert aux opportunités » qu'à partir d'Artisan", () => {
    for (const account of namedAccounts.filter((entry) => entry.openToOpportunities)) {
      expect(isLevelAtLeast(levels.get(account.handle) as never, "artisan"), account.handle).toBe(true);
    }
  });

  it("donne à chaque ligne du registre une source qui existe", async () => {
    const [orphans] = await db.execute<{ count: string }>(sql`
      select count(*) from ${pointsLedger} l where not exists (
        select 1 from post_replies where id = l.source_id
        union all select 1 from post_feedback where id = l.source_id
        union all select 1 from applications where id = l.source_id
        union all select 1 from submissions where id = l.source_id
        union all select 1 from credentials where id = l.source_id and status = 'verified'
        union all select 1 from assistant_invocations where id = l.source_id
      )`);
    expect(Number(orphans!.count)).toBe(0);
  });

  it("réserve la notation du jury aux niveaux Architecte et Légende", async () => {
    const jurors = await db.selectDistinct({ jurorId: juryScores.jurorId }).from(juryScores);
    const points = await computeProfilesPoints(db, jurors.map((juror) => juror.jurorId));
    for (const juror of jurors) {
      expect(isLevelAtLeast(points.get(juror.jurorId)!.level, "architecte")).toBe(true);
    }
  });

  it("attribue le podium comme le serveur : relire les résultats n'ajoute aucun point", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      payload: { email: "amina.diallo@demo.kemet.africa", password: "demonstration" },
    });
    const raw = signIn.headers["set-cookie"];
    const cookie = String(Array.isArray(raw) ? raw[0] : raw).split(";")[0]!;
    const before = await db.$count(pointsLedger);

    const results = await app.inject({
      method: "GET",
      url: "/api/competitions/cadev-mini-defi-produit/results",
      headers: { cookie },
    });
    expect(results.statusCode).toBe(200);
    expect(await db.$count(pointsLedger)).toBe(before);
  });
});
