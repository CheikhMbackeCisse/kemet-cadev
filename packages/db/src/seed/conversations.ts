import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { channels, conversationMembers, conversations, messages, works } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { hoursAgo } from "./time.js";

type AccountKey = keyof DemoAccountIds;
type MemberStatus = (typeof conversationMembers.$inferInsert)["status"];

interface DemoConversation {
  createdBy: AccountKey;
  members: { key: AccountKey; status: MemberStatus }[];
  /** Conversation d'équipe : écrite aux auteurs de ce travail. */
  workSlug?: string;
  messages: { author: AccountKey; body: string; hoursAgo: number }[];
}

// Mêmes règles que le serveur (docs/adr/0026-messagerie-privee.md) : une
// demande pas encore acceptée ne contient qu'un seul message, et une
// conversation d'équipe arrive en demande chez chaque auteur.
const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    createdBy: "ahouKouadio",
    members: [
      { key: "ahouKouadio", status: "accepted" },
      { key: "coumbaThiam", status: "accepted" },
    ],
    messages: [
      {
        author: "ahouKouadio",
        body: "Bonjour Coumba, merci pour la réponse sur les portfolios. Je peux vous montrer mon CV avant de postuler pour l'alternance de juin ?",
        hoursAgo: 37,
      },
      {
        author: "coumbaThiam",
        body: "Bien sûr, envoie. Et tutoie-moi, ici tout le monde se tutoie.",
        hoursAgo: 36,
      },
      {
        author: "ahouKouadio",
        body: "D'accord ! Je l'ai mis en ligne avec mes trois jeux. Le plus abouti, c'est celui de cartes, mais il saccade encore sur les vieux téléphones.",
        hoursAgo: 35.5,
      },
      {
        author: "coumbaThiam",
        body: "Mets ce problème dans le CV, avec ce que tu as essayé. Un recruteur préfère quelqu'un qui sait décrire un bug à quelqu'un qui prétend ne pas en avoir.",
        hoursAgo: 34,
      },
    ],
  },
  {
    createdBy: "heritierKabeya",
    members: [
      { key: "heritierKabeya", status: "accepted" },
      { key: "kipronoLangat", status: "pending" },
    ],
    messages: [
      {
        author: "heritierKabeya",
        body: "Bonjour, j'ai vu l'offre backend Java. Je viens de l'embarqué, je n'ai jamais fait de Kafka, mais j'ai un projet de capteurs LoRa avec une API. Est-ce que ça vaut la peine que je postule ?",
        hoursAgo: 16,
      },
    ],
  },
  {
    createdBy: "skanderJaziri",
    workSlug: "idempotence-paiements-mobile-money",
    members: [
      { key: "skanderJaziri", status: "accepted" },
      { key: "kipronoLangat", status: "accepted" },
      { key: "coumbaThiam", status: "pending" },
    ],
    messages: [
      {
        author: "skanderJaziri",
        body: "Bonjour à vous deux. J'ai un client e-commerce qui a des doublons de paiement après coupure réseau. Votre article m'a déjà aidé, est-ce que je peux vous poser deux questions sur votre table d'idempotence ?",
        hoursAgo: 10,
      },
      {
        author: "kipronoLangat",
        body: "Vas-y. Coumba verra le message quand elle acceptera la conversation.",
        hoursAgo: 9,
      },
    ],
  },
  {
    createdBy: "lynaBouzid",
    members: [
      { key: "lynaBouzid", status: "accepted" },
      { key: "skanderJaziri", status: "accepted" },
      { key: "dapoOyelaran", status: "accepted" },
    ],
    messages: [
      {
        author: "lynaBouzid",
        body: 'Petit groupe freelances : un client veut "une refonte rapide" de son site et de sa CI. Qui prend le front, qui prend le back, et je garde le déploiement ?',
        hoursAgo: 28,
      },
      {
        author: "dapoOyelaran",
        body: "Je prends le front si la maquette existe déjà. Sinon c'est un autre devis.",
        hoursAgo: 27,
      },
      {
        author: "skanderJaziri",
        body: "Back pour moi. On se fait un appel jeudi pour découper ?",
        hoursAgo: 26,
      },
      {
        author: "lynaBouzid",
        body: "Jeudi 18 h, heure d'Alger. Je prépare la liste de ce qui n'est pas inclus.",
        hoursAgo: 25,
      },
    ],
  },
];

function directKeyFor(firstProfileId: string, secondProfileId: string): string {
  return [firstProfileId, secondProfileId].sort().join(":");
}

/** Quelques conversations privées : une à deux, une demande, une d'équipe, un groupe. */
export async function createDemoConversations(db: DbOrTx, ids: DemoAccountIds): Promise<void> {
  for (const demo of DEMO_CONVERSATIONS) {
    const startedAt = hoursAgo(demo.messages[0]!.hoursAgo);
    let workId: string | null = null;
    if (demo.workSlug) {
      const [work] = await db
        .select({ id: works.id })
        .from(works)
        .where(eq(works.slug, demo.workSlug));
      if (!work) throw new Error(`Travail de démonstration introuvable : ${demo.workSlug}`);
      workId = work.id;
    }
    const directKey =
      !workId && demo.members.length === 2
        ? directKeyFor(ids[demo.members[0]!.key], ids[demo.members[1]!.key])
        : null;

    const [conversation] = await db
      .insert(conversations)
      .values({ createdBy: ids[demo.createdBy], directKey, workId, createdAt: startedAt })
      .returning({ id: conversations.id });
    const [channel] = await db
      .insert(channels)
      .values({
        conversationId: conversation!.id,
        name: "conversation",
        slug: "conversation",
        createdAt: startedAt,
      })
      .returning({ id: channels.id });
    await db.insert(conversationMembers).values(
      demo.members.map((member) => ({
        conversationId: conversation!.id,
        profileId: ids[member.key],
        status: member.status,
        joinedAt: startedAt,
        respondedAt: member.status === "accepted" ? startedAt : null,
      })),
    );
    await db.insert(messages).values(
      demo.messages.map((message) => ({
        channelId: channel!.id,
        authorId: ids[message.author],
        clientId: randomUUID(),
        body: message.body,
        createdAt: hoursAgo(message.hoursAgo),
      })),
    );
  }
}
