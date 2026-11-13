import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../client.js";
import { computeProfilePoints } from "../points-total.js";
import {
  account,
  pointsLedger,
  posts,
  profiles,
  skills,
  user,
  workLinks,
  WORK_DISCUSSIONS_SPACE_ID,
  workMedia,
  works,
} from "../schema/index.js";
import { getTestDatabaseUrl, resetTestDatabase } from "../testing.js";
import { readAccountPlan } from "./plan.js";
import { prepareAccount, PreparationRefusedError } from "./prepare-account.js";

const databaseUrl = getTestDatabaseUrl();
const COVER = join(import.meta.dirname, "../../seed-assets/out/work-a11y-cover.jpg");
const EMAIL = "personne@test.kemet";

async function writePlan(overrides: Record<string, unknown> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "kemet-plan-"));
  await copyFile(COVER, join(dir, "couverture.jpg"));
  await writeFile(join(dir, "skill.md"), "# Déployer\n\nÉtape par étape.\n");
  const plan = {
    email: EMAIL.toUpperCase(),
    profilsSimilaires: "pseudo",
    profil: {
      nom: "Awa Ndiaye",
      identifiant: "awa-10dev",
      role: "student",
      etablissement: "École polytechnique de Thiès (EPT)",
      pays: "SN",
    },
    travaux: [
      {
        identifiant: "plateforme-test",
        titre: "Une plateforme de test",
        type: "application",
        statut: "completed",
        resume: "Une plateforme pour vérifier la préparation d'un compte.",
        tags: ["Web"],
        stack: ["React"],
        annee: 2026,
        liens: [{ type: "site", url: "https://example.com", libelle: "En ligne" }],
        couverture: "couverture.jpg",
        galerie: ["couverture.jpg"],
      },
    ],
    skills: [
      {
        identifiant: "deployer-test",
        titre: "Déployer une application",
        resume: "Les étapes suivies pour déployer une application.",
        tags: ["deploiement"],
        contenu: "skill.md",
      },
    ],
    ...overrides,
  };
  const path = join(dir, "compte.json");
  await writeFile(path, JSON.stringify(plan));
  return { path, uploadsDir: join(dir, "uploads") };
}

describe.skipIf(!databaseUrl)("préparation d'un compte réel", () => {
  const db = createDb(databaseUrl ?? "");

  beforeEach(async () => {
    await resetTestDatabase(databaseUrl!);
  });

  async function createAccount(email: string, handle: string, emailVerified = true) {
    const userId = randomUUID();
    await db.insert(user).values({ id: userId, name: handle, email, emailVerified });
    await db
      .insert(account)
      .values({ id: randomUUID(), accountId: userId, providerId: "google", userId });
    const [profile] = await db
      .insert(profiles)
      .values({ userId, handle, displayName: "Pseudo_dev", country: "SN", role: "student" })
      .returning();
    return profile!;
  }

  it("ne fait rien quand aucun compte n'a cette adresse", async () => {
    const { path, uploadsDir } = await writePlan();
    const report = await prepareAccount(db, await readAccountPlan(path), {
      uploadsDir,
      dryRun: false,
    });
    expect(report.outcome).toBe("not_found");
    expect(await db.select().from(works)).toHaveLength(0);
  });

  it("prépare le profil, les travaux, les skills et les points, une seule fois", async () => {
    const profile = await createAccount(EMAIL, "ancien-pseudo");
    const other = await createAccount("autre@test.kemet", "pseudosn");
    const { path, uploadsDir } = await writePlan();
    const plan = await readAccountPlan(path);

    const report = await prepareAccount(db, plan, { uploadsDir, dryRun: false });
    expect(report.outcome).toBe("done");
    expect(report.providers).toEqual(["google"]);
    expect(report.previousHandle).toBe("ancien-pseudo");
    expect(report.similarProfiles.map((row) => row.handle)).toEqual(["pseudosn"]);
    expect(report.targetPoints).toBe(1600);
    expect(report.totalPoints).toBe(1600);
    expect(report.level).toBe("scribe");

    const [updated] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    expect(updated).toMatchObject({
      displayName: "Awa Ndiaye",
      handle: "awa-10dev",
      organization: "École polytechnique de Thiès (EPT)",
      country: "SN",
    });
    expect(updated!.onboardingCompletedAt).not.toBeNull();

    const [work] = await db.select().from(works).where(eq(works.publisherId, profile.id));
    expect(work).toMatchObject({ slug: "plateforme-test", isDemo: false, status: "completed" });
    expect(work!.channelId).not.toBeNull();
    expect(await db.select().from(workLinks).where(eq(workLinks.workId, work!.id))).toHaveLength(1);
    const media = await db.select().from(workMedia).where(eq(workMedia.workId, work!.id));
    expect(media.map((row) => row.role).sort()).toEqual(["cover", "gallery"]);
    expect(await readdir(uploadsDir)).toHaveLength(2);
    expect(await db.select().from(posts).where(eq(posts.workId, work!.id))).toHaveLength(1);
    expect(await db.select().from(skills).where(eq(skills.authorId, profile.id))).toHaveLength(1);

    const again = await prepareAccount(db, plan, { uploadsDir, dryRun: false });
    expect(again.worksSkipped).toEqual(["plateforme-test"]);
    expect(again.skillsSkipped).toEqual(["deployer-test"]);
    expect(again.totalPoints).toBe(1600);
    expect(await db.select().from(works)).toHaveLength(1);
    const demoRows = await db
      .select()
      .from(pointsLedger)
      .where(and(eq(pointsLedger.profileId, profile.id), eq(pointsLedger.source, "demonstration")));
    expect(demoRows).toHaveLength(1);

    const [untouched] = await db.select().from(profiles).where(eq(profiles.id, other.id));
    expect(untouched).toMatchObject({ handle: "pseudosn", displayName: "Pseudo_dev" });
    expect((await computeProfilePoints(db, other.id)).totalPoints).toBe(0);
  });

  it("ajuste la ligne de démonstration aux points déjà gagnés", async () => {
    const profile = await createAccount(EMAIL, "ancien-pseudo");
    await db.insert(pointsLedger).values({
      profileId: profile.id,
      source: "credential_verified",
      sourceId: randomUUID(),
      amount: 150,
    });
    const { path, uploadsDir } = await writePlan();
    const report = await prepareAccount(db, await readAccountPlan(path), {
      uploadsDir,
      dryRun: false,
    });
    expect(report.demonstrationPoints).toBe(1450);
    expect(report.totalPoints).toBe(1600);
  });

  it("n'écrit rien en essai", async () => {
    const profile = await createAccount(EMAIL, "ancien-pseudo");
    const { path, uploadsDir } = await writePlan();
    const report = await prepareAccount(db, await readAccountPlan(path), {
      uploadsDir,
      dryRun: true,
    });
    expect(report).toMatchObject({ outcome: "dry_run", demonstrationPoints: 1600, totalPoints: 0 });
    const [unchanged] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    expect(unchanged!.handle).toBe("ancien-pseudo");
    expect(await db.select().from(works)).toHaveLength(0);
    expect(await db.select().from(pointsLedger)).toHaveLength(0);
  });

  it("refuse sans rien écrire quand l'identifiant est déjà pris", async () => {
    const profile = await createAccount(EMAIL, "ancien-pseudo");
    await createAccount("autre@test.kemet", "awa-10dev");
    const { path, uploadsDir } = await writePlan();
    await expect(
      prepareAccount(db, await readAccountPlan(path), { uploadsDir, dryRun: false }),
    ).rejects.toBeInstanceOf(PreparationRefusedError);
    const [unchanged] = await db.select().from(profiles).where(eq(profiles.id, profile.id));
    expect(unchanged!.displayName).toBe("Pseudo_dev");
    expect(await db.select().from(works)).toHaveLength(0);
  });

  it("refuse un chemin qui sort du dossier du fichier", async () => {
    const { path } = await writePlan({
      skills: [
        {
          identifiant: "x-y-z",
          titre: "Titre",
          resume: "Un résumé assez long.",
          contenu: "../secret.md",
        },
      ],
    });
    await expect(readAccountPlan(path)).rejects.toThrow(/hors du dossier/);
  });

  it("refuse un compte dont l'adresse n'a jamais été vérifiée", async () => {
    await createAccount(EMAIL, "ancien-pseudo", false);
    const { path, uploadsDir } = await writePlan();
    await expect(
      prepareAccount(db, await readAccountPlan(path), { uploadsDir, dryRun: false }),
    ).rejects.toThrow(/jamais été vérifiée/);
    expect(await db.select().from(works)).toHaveLength(0);
  });

  it("ne laisse aucun fichier quand la transaction échoue", async () => {
    await createAccount(EMAIL, "ancien-pseudo");
    // Un salon du même identifiant dans l'espace des travaux fait échouer la
    // publication après l'écriture des images.
    await db.execute(
      sql`insert into channels (space_id, name, slug) values (${WORK_DISCUSSIONS_SPACE_ID}, 'pris', 'plateforme-test')`,
    );
    const { path, uploadsDir } = await writePlan();
    await expect(
      prepareAccount(db, await readAccountPlan(path), { uploadsDir, dryRun: false }),
    ).rejects.toThrow();
    expect(await readdir(uploadsDir)).toHaveLength(0);
    const [unchanged] = await db
      .select()
      .from(profiles)
      .where(
        eq(profiles.userId, (await db.select().from(user).where(eq(user.email, EMAIL)))[0]!.id),
      );
    expect(unchanged!.handle).toBe("ancien-pseudo");
  });
});
