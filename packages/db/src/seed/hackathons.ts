import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { channels, messages, profiles, spaceMembers, spaces } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { hoursAgo } from "./time.js";

// Espace "Hackathons et concours" : annonces, équipes qui se forment, retours
// après l'épreuve. Tous les événements cités sont inventés.

const SPACE_ID = demoUuid("space-hackathons");
const SPACE_SLUG = "hackathons-concours";
const OWNER_HANDLE = "kiprono-langat";
const FILLER_MEMBERS = 640;

const CHANNELS = [
  { key: "annonces", name: "annonces", order: 0 },
  { key: "equipes", name: "équipes", order: 1 },
  { key: "retours", name: "retours", order: 2 },
] as const;

type ChannelKey = (typeof CHANNELS)[number]["key"];

interface HackathonMessage {
  key: string;
  channel: ChannelKey;
  authorHandle: string;
  hoursAgo: number;
  body: string;
}

export const HACKATHON_MESSAGES: HackathonMessage[] = [
  {
    key: "a1",
    channel: "annonces",
    authorHandle: "kiprono-langat",
    hoursAgo: 96,
    body:
      "Inscriptions ouvertes pour le Défi Baobab IoT : 48 h pour mesurer l'eau d'un jardin " +
      "maraîcher avec un capteur à moins de 15 000 FCFA. Équipes de 2 à 4, matériel prêté sur place.",
  },
  {
    key: "a2",
    channel: "annonces",
    authorHandle: "coumba-thiam",
    hoursAgo: 70,
    body:
      "Hackathon des Filaos le mois prochain : thème paiements hors ligne. Le jury veut voir une " +
      "démo qui marche sans réseau, pas des maquettes.",
  },
  {
    key: "a3",
    channel: "annonces",
    authorHandle: "aissatou-barry",
    hoursAgo: 30,
    body:
      "Kobo Market offre un prix spécial au meilleur outil pour les vendeuses du marché : stock, " +
      "crédit client, ce que vous voulez. On teste avec de vraies vendeuses le dimanche suivant.",
  },
  {
    key: "a4",
    channel: "annonces",
    authorHandle: "kiprono-langat",
    hoursAgo: 6,
    body: "Rappel : clôture des inscriptions au Défi Baobab IoT vendredi à minuit, heure de Nairobi.",
  },
  {
    key: "e1",
    channel: "equipes",
    authorHandle: "heritier-kabeya",
    hoursAgo: 90,
    body:
      "Je fais du firmware ESP32 et LoRa. Je cherche quelqu'un pour l'appli mobile et quelqu'un " +
      "qui aime les tableaux de bord pour le Défi Baobab.",
  },
  {
    key: "e2",
    channel: "equipes",
    authorHandle: "ebo-quansah",
    hoursAgo: 88,
    body: "Partant pour l'appli, en Flutter. Hors ligne d'abord, synchro quand le réseau revient ?",
  },
  {
    key: "e3",
    channel: "equipes",
    authorHandle: "kgomotso-mahlangu",
    hoursAgo: 85,
    body: "Je prends le tableau de bord. On se cale un appel ce soir pour découper le travail ?",
  },
  {
    key: "e4",
    channel: "equipes",
    authorHandle: "yannick-mbarga",
    hoursAgo: 40,
    body:
      "Première participation pour moi, en licence 1. Une équipe accepte quelqu'un qui débute ? " +
      "Je peux tester, écrire la doc et préparer la présentation.",
  },
  {
    key: "e5",
    channel: "equipes",
    authorHandle: "skander-jaziri",
    hoursAgo: 38,
    body:
      "Viens avec nous pour le Hackathon des Filaos, Yannick. Une personne qui teste vraiment " +
      "vaut mieux qu'un quatrième développeur.",
  },
  {
    key: "e6",
    channel: "equipes",
    authorHandle: "salma-haddad",
    hoursAgo: 12,
    body: "Il reste une place dans une équipe pour le prix Kobo Market ? Je fais du Python.",
  },
  {
    key: "r1",
    channel: "retours",
    authorHandle: "lyna-bouzid",
    hoursAgo: 150,
    body:
      "Retour de la Nuit du code de Kumasi : notre démo est tombée parce que l'API externe a coupé " +
      "à 3 h du matin. Leçon apprise : toujours une réponse enregistrée sous la main.",
  },
  {
    key: "r2",
    channel: "retours",
    authorHandle: "dapo-oyelaran",
    hoursAgo: 148,
    body:
      "Pareil chez nous. Et le jury a passé plus de temps sur la page d'accueil que sur le code. " +
      "Soignez les trois premiers écrans.",
  },
  {
    key: "r3",
    channel: "retours",
    authorHandle: "ahou-kouadio",
    hoursAgo: 60,
    body:
      "Deuxième place au concours de jeux du campus. Ce qui a marché : une démo de 90 secondes, " +
      "répétée dix fois, et une seule idée par écran.",
  },
  {
    key: "r4",
    channel: "retours",
    authorHandle: "mariam-diakite",
    hoursAgo: 20,
    body:
      "Côté recrutement, je lis les dépôts des hackathons. Un README qui dit ce que vous avez fait " +
      "vous-même, dans l'équipe, change tout.",
  },
];

const AUTHOR_HANDLES = [...new Set(HACKATHON_MESSAGES.map((message) => message.authorHandle))];

export interface HackathonsResult {
  status: "done" | "skipped";
  reason?: string;
  messages: number;
}

function channelId(key: ChannelKey): string {
  return demoUuid(`channel-hackathons-${key}`);
}

/**
 * Crée l'espace s'il manque, puis ajoute membres et messages manquants.
 * Relançable. Ne fait rien si un vrai espace a déjà pris l'identifiant.
 */
export async function seedHackathonsSpace(db: DbOrTx): Promise<HackathonsResult> {
  const [existing] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.slug, SPACE_SLUG));
  if (existing && existing.id !== SPACE_ID)
    return { status: "skipped", reason: "identifiant d'espace déjà pris", messages: 0 };

  const authors = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(and(inArray(profiles.handle, AUTHOR_HANDLES), eq(profiles.isDemo, true)));
  const ids = new Map(authors.map((row) => [row.handle, row.id]));
  const ownerId = ids.get(OWNER_HANDLE);
  if (!ownerId || ids.size !== AUTHOR_HANDLES.length)
    return { status: "skipped", reason: "comptes de démonstration absents", messages: 0 };

  return db.transaction(async (tx) => {
    await tx
      .insert(spaces)
      .values({
        id: SPACE_ID,
        name: "Hackathons et concours",
        slug: SPACE_SLUG,
        description:
          "Annonces de hackathons, équipes qui se forment, retours après l'épreuve. Débutants bienvenus.",
        visibility: "public",
        createdBy: ownerId,
        createdAt: hoursAgo(24 * 20),
      })
      .onConflictDoNothing();
    await tx
      .insert(channels)
      .values(
        CHANNELS.map((channel) => ({
          id: channelId(channel.key),
          spaceId: SPACE_ID,
          name: channel.name,
          slug: channel.key,
          displayOrder: channel.order,
        })),
      )
      .onConflictDoNothing();

    const fillers = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.isFiller, true))
      .orderBy(asc(profiles.id))
      .limit(FILLER_MEMBERS);
    await tx
      .insert(spaceMembers)
      .values([
        { spaceId: SPACE_ID, profileId: ownerId, role: "owner" as const },
        ...[...ids.values()]
          .filter((id) => id !== ownerId)
          .map((profileId) => ({ spaceId: SPACE_ID, profileId, role: "member" as const })),
        ...fillers.map((row) => ({
          spaceId: SPACE_ID,
          profileId: row.id,
          role: "member" as const,
        })),
      ])
      .onConflictDoNothing();

    const inserted = await tx
      .insert(messages)
      .values(
        HACKATHON_MESSAGES.map((message) => ({
          channelId: channelId(message.channel),
          authorId: ids.get(message.authorHandle)!,
          clientId: `demo-hackathons-${message.key}`,
          body: message.body,
          createdAt: hoursAgo(message.hoursAgo),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: messages.id });
    return { status: "done", messages: inserted.length };
  });
}
