import { hash } from "@node-rs/argon2";
import { createDb, type Db } from "./client.js";
import { follows } from "./schema/index.js";
import { createDemoAccounts, type DemoAccountIds } from "./seed/accounts.js";
import { createCadevSpace } from "./seed/chat-content.js";
import { createCommunitySpaces } from "./seed/community.js";
import { createDemoCompetitions } from "./seed/competitions.js";
import { createFeedContent } from "./seed/feed.js";
import { generateFillerProfiles, insertFillerProfiles } from "./seed/filler-profiles.js";
import { createCommunityFollows } from "./seed/follows.js";
import { createDemoProjects } from "./seed/projects.js";
import { createDemoSkills } from "./seed/skills.js";

/**
 * Mot de passe commun des comptes de démonstration, pour que le jury puisse
 * se connecter sans fouiller la base. Ces comptes ont `is_demo = true` et ne
 * doivent jamais être utilisés en production.
 */
const DEMO_PASSWORD = "demonstration";

// Taille du bassin de profils de remplissage : assez grand pour qu'un
// espace vitrine ("Carrière & Freelance Tech") affiche un nombre de
// membres à cinq chiffres, et pour fournir assez d'abonnés et de votes aux
// autres espaces et compétitions sans jamais les épuiser.
const FILLER_PROFILE_COUNT = 12_300;

async function followAllNamedAccounts(db: Db, ids: DemoAccountIds): Promise<void> {
  // Les dix comptes nommés suivent tous Amina Diallo, le compte admin de la
  // plateforme : garde la démonstration cohérente même sans le bassin de
  // remplissage (voir seed/follows.ts pour leurs abonnés de remplissage).
  const otherKeys = (Object.keys(ids) as (keyof DemoAccountIds)[]).filter((key) => key !== "aminaDiallo");
  await db.insert(follows).values(otherKeys.map((key) => ({ followerId: ids[key], followeeId: ids.aminaDiallo })));
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Le seed crée des comptes avec un mot de passe public (demonstration) : refusé quand NODE_ENV=production.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL ?? "postgres://kemet:kemet@localhost:5432/kemet";
  const db = createDb(databaseUrl);
  const passwordHash = await hash(DEMO_PASSWORD);

  const ids = await createDemoAccounts(db, passwordHash);
  await followAllNamedAccounts(db, ids);

  console.log(`Génération de ${FILLER_PROFILE_COUNT} profils de remplissage…`);
  const fillerSeeds = generateFillerProfiles(FILLER_PROFILE_COUNT);
  const fillerProfileIds = await insertFillerProfiles(db, fillerSeeds);

  await createDemoSkills(db, ids);
  await createCadevSpace(db, ids);
  await createCommunitySpaces(db, ids, fillerProfileIds);
  await createCommunityFollows(db, ids, fillerProfileIds);
  await createFeedContent(db, ids);
  const projectIds = await createDemoProjects(db, ids);
  await createDemoCompetitions(db, ids, projectIds, fillerProfileIds);

  console.log(`10 comptes de démonstration créés (mot de passe : ${DEMO_PASSWORD}).`);
  console.log(`${fillerProfileIds.length} profils de remplissage créés (jamais de connexion possible).`);
  console.log("Espace \"CADEV 2026\" et huit espaces communautaires créés avec leurs salons et membres.");
  console.log("Fil de posts, skills, projets et compétitions de démonstration créés.");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
