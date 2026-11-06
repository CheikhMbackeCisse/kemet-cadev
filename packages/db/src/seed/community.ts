import type { DbOrTx } from "../client.js";
import { channels, spaceMembers, spaces } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { chunk } from "./chunk.js";
import { seededShuffle } from "./filler-profiles.js";

interface CommunitySpaceSeed {
  name: string;
  slug: string;
  description: string;
  ownerKey: keyof DemoAccountIds;
  earlyMemberKeys: (keyof DemoAccountIds)[];
  channelNames: { name: string; slug: string }[];
  memberCount: number;
}

// Huit espaces publics d'effectifs variés, pris dans le bassin de profils
// de remplissage.
const COMMUNITY_SPACES: CommunitySpaceSeed[] = [
  {
    name: "Flutter Afrique",
    slug: "flutter-afrique",
    description: "Développeurs et développeuses Flutter du continent : widgets, performance, publication.",
    ownerKey: "eboQuansah",
    earlyMemberKeys: ["ahouKouadio"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "aide-flutter", slug: "aide-flutter" },
      { name: "showcase", slug: "showcase" },
    ],
    memberCount: 2450,
  },
  {
    name: "Backend & API",
    slug: "backend-api",
    description: "Node.js, Java, bases de données : construire des API qui tiennent la charge.",
    ownerKey: "coumbaThiam",
    earlyMemberKeys: ["kipronoLangat"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "performance", slug: "performance" },
      { name: "bonnes-pratiques", slug: "bonnes-pratiques" },
    ],
    memberCount: 3180,
  },
  {
    name: "Data & Intelligence Artificielle",
    slug: "data-ia",
    description: "Machine learning, NLP, pipelines de données : la data en Afrique.",
    ownerKey: "ghizlaneAmrani",
    earlyMemberKeys: ["kgomotsoMahlangu"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "nlp-rag", slug: "nlp-rag" },
      { name: "mlops", slug: "mlops" },
    ],
    memberCount: 5920,
  },
  {
    name: "DevOps & Cloud Afrique",
    slug: "devops-cloud-afrique",
    description: "Kubernetes, CI/CD, infrastructure : fiabiliser ce qui tourne en production.",
    ownerKey: "lynaBouzid",
    earlyMemberKeys: ["kipronoLangat"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "kubernetes", slug: "kubernetes" },
      { name: "ci-cd", slug: "ci-cd" },
    ],
    memberCount: 1860,
  },
  {
    name: "Frontend & Design Systems",
    slug: "frontend-design-systems",
    description: "React, accessibilité, performance web : construire des interfaces soignées.",
    ownerKey: "dapoOyelaran",
    earlyMemberKeys: ["skanderJaziri"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "accessibilite", slug: "accessibilite" },
      { name: "performance-web", slug: "performance-web" },
    ],
    memberCount: 4340,
  },
  {
    name: "Jeux Vidéo Afrique",
    slug: "jeux-video-afrique",
    description: "Game design, moteurs de jeu, publication mobile : le jeu vidéo fait en Afrique.",
    ownerKey: "ahouKouadio",
    earlyMemberKeys: ["eboQuansah"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "gamedev-mobile", slug: "gamedev-mobile" },
    ],
    memberCount: 980,
  },
  {
    name: "Cybersécurité",
    slug: "cybersecurite",
    description: "Sécurité applicative, audits, réponse à incident : protéger ce qu'on construit.",
    ownerKey: "kipronoLangat",
    earlyMemberKeys: ["lynaBouzid"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "pentest", slug: "pentest" },
    ],
    memberCount: 1540,
  },
  {
    name: "Carrière & Freelance Tech",
    slug: "carriere-freelance-tech",
    description: "Offres, portfolios, négociation de contrats : l'espace carrière de toute la communauté.",
    ownerKey: "skanderJaziri",
    earlyMemberKeys: ["coumbaThiam", "dapoOyelaran"],
    channelNames: [
      { name: "général", slug: "general" },
      { name: "offres", slug: "offres" },
      { name: "portfolio", slug: "portfolio" },
    ],
    // Espace vitrine : reprend tout le bassin de profils de remplissage.
    memberCount: Number.POSITIVE_INFINITY,
  },
];

const MEMBER_CHUNK_SIZE = 5000;

/** Identifiant de chaque salon, par slug d'espace puis slug de salon. */
export type CommunityChannelIds = Map<string, Map<string, string>>;

export async function createCommunitySpaces(
  db: DbOrTx,
  accountIds: DemoAccountIds,
  fillerProfileIds: string[],
): Promise<CommunityChannelIds> {
  const channelIds: CommunityChannelIds = new Map();
  for (const spaceSeed of COMMUNITY_SPACES) {
    const ownerId = accountIds[spaceSeed.ownerKey];
    const [space] = await db
      .insert(spaces)
      .values({
        name: spaceSeed.name,
        slug: spaceSeed.slug,
        description: spaceSeed.description,
        visibility: "public",
        createdBy: ownerId,
      })
      .returning({ id: spaces.id });
    const spaceId = space!.id;

    const insertedChannels = await db
      .insert(channels)
      .values(
        spaceSeed.channelNames.map((channel, index) => ({
          spaceId,
          name: channel.name,
          slug: channel.slug,
          displayOrder: index,
        })),
      )
      .returning({ id: channels.id, slug: channels.slug });
    channelIds.set(spaceSeed.slug, new Map(insertedChannels.map((channel) => [channel.slug, channel.id])));

    const targetFillerCount = Number.isFinite(spaceSeed.memberCount)
      ? Math.max(0, spaceSeed.memberCount - 1 - spaceSeed.earlyMemberKeys.length)
      : fillerProfileIds.length;
    const fillerMembers = seededShuffle(fillerProfileIds, `space-members-${spaceSeed.slug}`).slice(0, targetFillerCount);

    const memberRows = [
      { spaceId, profileId: ownerId, role: "owner" as const },
      ...spaceSeed.earlyMemberKeys.map((key) => ({ spaceId, profileId: accountIds[key], role: "admin" as const })),
      ...fillerMembers.map((profileId) => ({ spaceId, profileId, role: "member" as const })),
    ];
    for (const batch of chunk(memberRows, MEMBER_CHUNK_SIZE)) {
      await db.insert(spaceMembers).values(batch);
    }
  }
  return channelIds;
}
