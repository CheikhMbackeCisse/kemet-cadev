import { resolve } from "node:path";
import { createDb } from "./client.js";
import { readAccountPlan } from "./account-preparation/plan.js";
import { prepareAccount, type PreparationReport } from "./account-preparation/prepare-account.js";

const USAGE = "Usage : node dist/prepare-account.js <fichier.json> [--essai]";

function printReport(report: PreparationReport): void {
  if (report.outcome === "not_found") {
    console.log("Aucun compte avec cette adresse : rien n'a été fait.");
    return;
  }
  const lines = [
    report.outcome === "dry_run" ? "Essai : rien n'a été écrit." : "Compte préparé.",
    `Connexion : ${report.providers.join(", ") || "aucune"} (email ${report.emailVerified ? "vérifié" : "non vérifié"})`,
    `Avant : ${report.previousDisplayName} (@${report.previousHandle})`,
    `Travaux créés : ${report.worksCreated.join(", ") || "aucun"}`,
    `Travaux déjà présents : ${report.worksSkipped.join(", ") || "aucun"}`,
    `Skills créés : ${report.skillsCreated.join(", ") || "aucun"}`,
    `Skills déjà présents : ${report.skillsSkipped.join(", ") || "aucun"}`,
    `Points visés : ${report.targetPoints}, ligne "demonstration" : ${report.demonstrationPoints}`,
    `Total ${report.outcome === "dry_run" ? "actuel" : "après"} : ${report.totalPoints} points, niveau ${report.level}`,
    `Images ajoutées : ${(report.imageBytes / 1024 / 1024).toFixed(1)} Mo (hors quota du compte)`,
    "Autres profils au nom proche (non modifiés) :",
    ...(report.similarProfiles.length === 0
      ? ["  aucun"]
      : report.similarProfiles.map(
          (row) => `  @${row.handle} : ${row.displayName}${row.isDemo ? " (démonstration)" : ""}`,
        )),
  ];
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--essai");
  const files = args.filter((arg) => arg !== "--essai");
  if (files.length !== 1) throw new Error(USAGE);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL non définie.");
  const uploadsDir = process.env.UPLOADS_DIR;
  if (!uploadsDir) throw new Error("UPLOADS_DIR non définie.");

  const plan = await readAccountPlan(resolve(files[0]!));
  const report = await prepareAccount(createDb(databaseUrl), plan, { uploadsDir, dryRun });
  printReport(report);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
