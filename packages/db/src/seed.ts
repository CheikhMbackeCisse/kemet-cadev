import { createDb } from "./client.js";
import { DEMO_PASSWORD, seedDemoDataset } from "./seed/demo-dataset.js";
import { hash } from "@node-rs/argon2";
import { seedDemoMedia } from "./seed/demo-media.js";
import { seedNewcomers } from "./seed/newcomers.js";
import { seedShowcase } from "./seed/showcase.js";
import { seedOpportunities } from "./seed/opportunities.js";
import { seedDemoOrganizations } from "./seed/organizations.js";
import { renameCadevSpace } from "./seed/chat-content.js";
import { completeDemoRoleDetails } from "./seed/role-details.js";
import { seedHackathonsSpace } from "./seed/hackathons.js";

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

  const cadev = await renameCadevSpace(db);
  if (cadev.spaces + cadev.messages > 0)
    console.log("Espace CADEV 2026 : ancienne description et message d'accueil remplacés.");

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
  const roleDetails = await completeDemoRoleDetails(db);
  if (roleDetails > 0)
    console.log(`Précision du rôle posée sur ${roleDetails} profils de démonstration.`);
  const hackathons = await seedHackathonsSpace(db);
  console.log(
    hackathons.status === "done"
      ? `Espace Hackathons et concours : ${hackathons.messages} messages ajoutés.`
      : `Espace Hackathons et concours sauté : ${hackathons.reason}.`,
  );
  const organizations = await seedDemoOrganizations(db);
  console.log(
    `Organisations : ${organizations.organizations} en place, ${organizations.posts} posts ajoutés` +
      (organizations.skipped.length > 0 ? `, sautées : ${organizations.skipped.join(", ")}.` : "."),
  );
  const offers = await seedOpportunities(db);
  console.log(
    offers.status === "done"
      ? `Opportunités : ${offers.created} offres ajoutées.`
      : `Opportunités sautées : ${offers.reason}.`,
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
  console.log(
    `Dimensions posées sur ${media.postImageSizes} images de posts. Post CADEV : ${media.cadevPost}.`,
  );
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
