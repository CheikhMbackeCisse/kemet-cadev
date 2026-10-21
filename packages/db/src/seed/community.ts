import type { Db } from "../client.js";
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

// Huit espaces publics au-delà de CADEV 2026, chacun avec un effectif
// différent : de quoi montrer des communautés de tailles variées plutôt
// qu'un seul espace de démonstration. "Carrière & Freelance Tech" reprend
// tout le bassin de profils de remplissage, les sept autres en reprennent
// des parts différentes.
const COMMUNITY_SPACES: CommunitySpaceSeed[] = [
  {
    name: "Flutter Afrique",
    slug: "flutter-afrique",
    description: "Développeurs et développeuses Flutter du continent : widgets, performance, publication.",
    ownerKey: "kwameAsante",
    earlyMemberKeys: ["aissatouToure"],
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
    ownerKey: "aminaDiallo",
    earlyMemberKeys: ["samuelMwangi"],
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
    ownerKey: "nadiaHassan",
    earlyMemberKeys: ["zaneleMokoena"],
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
    ownerKey: "fatimaBenali",
    earlyMemberKeys: ["samuelMwangi"],
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
    ownerKey: "chidiOkafor",
    earlyMemberKeys: ["yassineTrabelsi"],
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
    ownerKey: "aissatouToure",
    earlyMemberKeys: ["kwameAsante"],
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
    ownerKey: "samuelMwangi",
    earlyMemberKeys: ["fatimaBenali"],
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
    ownerKey: "yassineTrabelsi",
    earlyMemberKeys: ["aminaDiallo", "chidiOkafor"],
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

export async function createCommunitySpaces(db: Db, accountIds: DemoAccountIds, fillerProfileIds: string[]): Promise<void> {
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

    await db.insert(channels).values(
      spaceSeed.channelNames.map((channel, index) => ({
        spaceId,
        name: channel.name,
        slug: channel.slug,
        displayOrder: index,
      })),
    );

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
}
