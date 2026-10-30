import { createDb } from "./client.js";
import { DEMO_PASSWORD, seedDemoDataset } from "./seed/demo-dataset.js";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL non définie.");
  const result = await seedDemoDataset(createDb(databaseUrl));
  if (result.status === "already-present") {
    console.log("Données de démonstration déjà présentes : rien à faire.");
    return;
  }
  console.log(`10 comptes de démonstration créés (mot de passe : ${DEMO_PASSWORD}), aucun administrateur.`);
  console.log(`${result.fillerProfileCount} profils de remplissage créés (jamais de connexion possible).`);
  console.log("Espaces, salons, fil, skills, projets et compétitions de démonstration créés.");
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
