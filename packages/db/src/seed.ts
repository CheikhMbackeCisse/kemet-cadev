import { createDb } from "./client.js";
import { DEMO_PASSWORD, seedDemoDataset } from "./seed/demo-dataset.js";
import { hash } from "@node-rs/argon2";
import { seedDemoMedia } from "./seed/demo-media.js";
import { seedNewcomers } from "./seed/newcomers.js";
import { seedShowcase } from "./seed/showcase.js";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL non définie.");
  const db = createDb(databaseUrl);

  const result = await seedDemoDataset(db);
  if (result.status === "already-present") {
    console.log("Comptes de démonstration déjà présents : seule l'étape des médias est rejouée.");
  } else {
    console.log(
      `10 comptes de démonstration créés (mot de passe : ${DEMO_PASSWORD}), aucun administrateur.`,
    );
    console.log(
      `${result.fillerProfileCount} profils de remplissage créés (jamais de connexion possible).`,
    );
    console.log("Espaces, salons, fil, skills, projets et compétitions de démonstration créés.");
  }

  const uploadsDir = process.env.UPLOADS_DIR;
  if (!uploadsDir)
    console.warn("UPLOADS_DIR non définie : images et vidéos de démonstration non écrites.");
  const media = await seedDemoMedia(db, { uploadsDir });
  if (media.status === "skipped") {
    console.log(`Médias de démonstration sautés : ${media.reason}.`);
    return;
  }
  const newcomers = await seedNewcomers(db, {
    uploadsDir,
    passwordHash: () => hash(DEMO_PASSWORD),
  });
  if (newcomers.status === "skipped")
    console.log(`Débutants et recruteurs sautés : ${newcomers.reason}.`);
  else
    console.log(
      `Débutants et recruteurs : ${newcomers.accounts} comptes, ${newcomers.cvs} CV, ${newcomers.posts} posts ` +
        `et ${newcomers.spaceMessages} messages ajoutés.`,
    );
  const showcase = await seedShowcase(db);
  console.log(
    showcase.status === "done"
      ? "Vitrine du fil (question Wave et réponse de Kocc) en place."
      : `Vitrine du fil sautée : ${showcase.reason}.`,
  );
  console.log(
    `Médias de démonstration : ${media.posts} posts, ${media.postImages} images sur des posts existants, ` +
      `${media.works} travaux illustrés, ${media.banners} bannières, ${media.skillUses} utilisations ` +
      `et ${media.skillRatings} avis de skills ajoutés.`,
  );
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
