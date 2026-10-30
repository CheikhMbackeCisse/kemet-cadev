import { randomUUID } from "node:crypto";
import type { DbOrTx } from "../client.js";
import { profiles, user } from "../schema/index.js";
import { avatarDataUri } from "./avatar.js";
import { chunk } from "./chunk.js";

/**
 * Profils de remplissage : jamais de connexion possible (aucune ligne
 * `account`), juste de quoi peupler les salons et les abonnements à
 * l'échelle d'une vraie communauté plutôt qu'un cercle de dix comptes. Les
 * noms sont composés à partir de prénoms et noms plausibles par pays,
 * jamais tirés d'une vraie personne.
 */

interface CountryNames {
  code: string;
  firstNames: string[];
  lastNames: string[];
}

const COUNTRY_NAMES: CountryNames[] = [
  { code: "SN", firstNames: ["Mamadou", "Awa", "Ibrahima", "Fatou", "Moussa", "Khady", "Ousmane", "Aminata"], lastNames: ["Diop", "Ndiaye", "Fall", "Sow", "Gueye", "Diouf", "Sarr", "Ba"] },
  { code: "GH", firstNames: ["Kofi", "Ama", "Kwabena", "Efua", "Yaw", "Akosua", "Kojo", "Abena"], lastNames: ["Mensah", "Owusu", "Boateng", "Asante", "Appiah", "Addo", "Osei", "Agyeman"] },
  { code: "MA", firstNames: ["Youssef", "Imane", "Hamza", "Salma", "Adil", "Nadia", "Karim", "Houda"], lastNames: ["El Amrani", "Bennani", "Tazi", "Fassi", "Idrissi", "Alaoui", "Chraibi", "Berrada"] },
  { code: "NG", firstNames: ["Chinedu", "Ngozi", "Emeka", "Chiamaka", "Tunde", "Folake", "Uche", "Adaeze"], lastNames: ["Okafor", "Eze", "Okonkwo", "Adeyemi", "Balogun", "Uzo", "Nwachukwu", "Afolabi"] },
  { code: "ZA", firstNames: ["Thabo", "Lerato", "Sipho", "Nomvula", "Tshepo", "Palesa", "Bongani", "Zanele"], lastNames: ["Nkosi", "Dlamini", "Khumalo", "Mokoena", "Zulu", "Molefe", "Mahlangu", "Sithole"] },
  { code: "TN", firstNames: ["Mehdi", "Rania", "Walid", "Sana", "Bilel", "Amira", "Sami", "Yosra"], lastNames: ["Trabelsi", "Jebali", "Gharbi", "Khlifi", "Mansouri", "Bouazizi", "Hammami", "Sassi"] },
  { code: "CI", firstNames: ["Yao", "Aya", "Kouassi", "Adjoa", "Koffi", "Akissi", "Brice", "Mariam"], lastNames: ["Toure", "Kone", "Kouadio", "Yao", "Diabate", "Coulibaly", "Bamba", "Ouattara"] },
  { code: "KE", firstNames: ["Kevin", "Wanjiru", "Brian", "Achieng", "Otieno", "Njeri", "Kamau", "Wambui"], lastNames: ["Mwangi", "Kamau", "Otieno", "Njoroge", "Kariuki", "Omondi", "Wanjiku", "Mutua"] },
  { code: "EG", firstNames: ["Ahmed", "Mariam", "Omar", "Yasmin", "Khaled", "Dina", "Tarek", "Heba"], lastNames: ["Hassan", "Mahmoud", "Ibrahim", "Fawzy", "Sayed", "Gaber", "Abdel Rahman", "Shaker"] },
  { code: "CD", firstNames: ["Patrick", "Bijou", "Christian", "Nadege", "Trésor", "Grace", "Divin", "Merveille"], lastNames: ["Mukendi", "Kabongo", "Tshibangu", "Ilunga", "Mbuyi", "Kalala", "Lumumba", "Kasongo"] },
  { code: "DZ", firstNames: ["Yacine", "Amina", "Sofiane", "Lina", "Riad", "Nour", "Farid", "Meriem"], lastNames: ["Benali", "Boudiaf", "Cherif", "Haddad", "Mansour", "Belkacem", "Saidi", "Zidane"] },
  { code: "CM", firstNames: ["Serge", "Flore", "Armand", "Carine", "Blaise", "Delphine", "Herve", "Pauline"], lastNames: ["Mballa", "Fotso", "Njoya", "Tchoumi", "Ekotto", "Ngassa", "Biya", "Nkemayang"] },
  { code: "UG", firstNames: ["David", "Immaculate", "Joseph", "Grace", "Allan", "Patience", "Moses", "Sarah"], lastNames: ["Okello", "Nansubuga", "Mugisha", "Nakato", "Ssempala", "Kyeyune", "Were", "Namugga"] },
  { code: "TZ", firstNames: ["Juma", "Neema", "Baraka", "Zawadi", "Hassan", "Amani", "Rashidi", "Faraja"], lastNames: ["Mwakasege", "Kileo", "Mushi", "Shirima", "Massawe", "Kimaro", "Mrema", "Lyimo"] },
  { code: "RW", firstNames: ["Eric", "Chantal", "Jean Bosco", "Divine", "Pacifique", "Claudine", "Olivier", "Aline"], lastNames: ["Nshimiyimana", "Uwimana", "Habimana", "Mukamana", "Niyonzima", "Ingabire", "Bizimana", "Mutesi"] },
  { code: "BF", firstNames: ["Issa", "Salimata", "Boubacar", "Aminata", "Adama", "Rasmata", "Seydou", "Fatimata"], lastNames: ["Ouedraogo", "Kabore", "Sawadogo", "Compaore", "Zongo", "Traore", "Sanou", "Bamogo"] },
];

const TITLE_ARCHETYPES = [
  "Développeur backend",
  "Développeuse backend",
  "Développeur frontend",
  "Développeuse frontend",
  "Développeur mobile",
  "Développeuse mobile",
  "Ingénieur DevOps",
  "Ingénieure DevOps",
  "Data engineer",
  "Data scientist",
  "Ingénieur QA",
  "Ingénieure QA",
  "Designer produit",
  "Développeur full-stack",
  "Développeuse full-stack",
  "Chef de projet technique",
  "Architecte logiciel",
  "Développeur embarqué",
  "Ingénieur cloud",
  "Développeuse jeux vidéo",
  "Étudiant en informatique",
  "Étudiante en informatique",
  "Freelance web",
];

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface FillerProfileSeed {
  handle: string;
  email: string;
  displayName: string;
  country: string;
  title: string;
}

export function generateFillerProfiles(count: number): FillerProfileSeed[] {
  const rand = mulberry32(hashSeed(`kemet-filler-${count}`));
  const seeds: FillerProfileSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const country = COUNTRY_NAMES[Math.floor(rand() * COUNTRY_NAMES.length)]!;
    const first = country.firstNames[Math.floor(rand() * country.firstNames.length)]!;
    const last = country.lastNames[Math.floor(rand() * country.lastNames.length)]!;
    const title = TITLE_ARCHETYPES[Math.floor(rand() * TITLE_ARCHETYPES.length)]!;
    const handle = `${slugify(first)}-${slugify(last)}-${i}`;
    seeds.push({
      handle,
      email: `${handle}@demo.kemet.africa`,
      displayName: `${first} ${last}`,
      country: country.code,
      title,
    });
  }
  return seeds;
}

// Mélange déterministe (Fisher-Yates) : donne des sous-ensembles différents
// par espace et par abonnement sans que l'ordre d'insertion ne les biaise
// tous de la même façon.
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

const INSERT_CHUNK_SIZE = 1000;

export async function insertFillerProfiles(db: DbOrTx, seeds: FillerProfileSeed[]): Promise<string[]> {
  const profileIds: string[] = [];
  for (const batch of chunk(seeds, INSERT_CHUNK_SIZE)) {
    const userRows = batch.map((seed) => ({
      id: randomUUID(),
      name: seed.displayName,
      email: seed.email,
      emailVerified: true,
    }));
    await db.insert(user).values(userRows);

    const profileRows = batch.map((seed, index) => ({
      userId: userRows[index]!.id,
      handle: seed.handle,
      displayName: seed.displayName,
      country: seed.country,
      title: seed.title,
      avatarUrl: avatarDataUri(seed.handle),
      isDemo: true,
    }));
    const inserted = await db.insert(profiles).values(profileRows).returning({ id: profiles.id });
    profileIds.push(...inserted.map((row) => row.id));
  }
  return profileIds;
}
