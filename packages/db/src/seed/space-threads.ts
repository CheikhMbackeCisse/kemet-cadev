import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  assistantInvocations,
  channels,
  messages,
  profiles,
  skills,
  spaceMembers,
} from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import type { CommunityChannelIds } from "./community.js";
import { hoursAgo } from "./time.js";

type AccountKey = keyof DemoAccountIds;

interface ThreadReply {
  author: AccountKey;
  body: string;
  hoursAgo: number;
}

interface ChannelMessage {
  author: AccountKey;
  body: string;
  hoursAgo: number;
  replies?: ThreadReply[];
}

interface AssistantExchange {
  askedBy: AccountKey;
  question: string;
  skillSlug: string;
  answer: string;
  hoursAgo: number;
}

interface ChannelContent {
  space: string;
  channel: string;
  messages: ChannelMessage[];
  assistant?: AssistantExchange;
}

const ASSISTANT_HANDLE = "kemet";
const RESPONSE_DELAY_HOURS = 25 / 3600;

// Aucun "Utile" sur ces échanges : les niveaux des comptes de démonstration
// sont calculés à partir des points (voir mentoring.ts) et ne doivent pas
// bouger avec le contenu des salons.
const CHANNEL_CONTENT: ChannelContent[] = [
  {
    space: "backend-api",
    channel: "general",
    messages: [
      {
        author: "skanderJaziri",
        body: "Question qui va déclencher un débat : vous mettez vos migrations SQL dans le même dépôt que l'API, ou dans un dépôt à part ?",
        hoursAgo: 70,
        replies: [
          {
            author: "coumbaThiam",
            body: "Même dépôt, toujours. Une migration et le code qui la lit doivent partir dans la même revue, sinon quelqu'un finit par déployer l'un sans l'autre.",
            hoursAgo: 69,
          },
          {
            author: "lynaBouzid",
            body: "Pareil. Et la CI applique toutes les migrations sur une base vide à chaque pull request. Ça m'a évité deux catastrophes ce mois-ci.",
            hoursAgo: 68,
          },
          {
            author: "skanderJaziri",
            body: "Ok, débat clos plus vite que prévu.",
            hoursAgo: 67.5,
          },
        ],
      },
      {
        author: "heritierKabeya",
        body: "Premier vrai poste, première API en prod. Mon chef me dit de \"paginer par curseur\". J'ai fait `?page=3&limit=20` et il a soupiré. Qu'est-ce que j'ai raté ?",
        hoursAgo: 46,
        replies: [
          {
            author: "kipronoLangat",
            body:
              'Rien de grave, c\'est le passage obligé. Avec un offset, si une ligne est insérée pendant que tu lis, tu vois un élément deux fois ou tu en sautes un. Un curseur dit "donne-moi ce qui vient après celui-là" :\n\n' +
              "```sql\n" +
              "select * from orders\n" +
              "where (created_at, id) < ($1, $2)\n" +
              "order by created_at desc, id desc\n" +
              "limit 20;\n" +
              "```",
            hoursAgo: 45,
          },
          {
            author: "heritierKabeya",
            body: "Pourquoi l'`id` en plus de la date ?",
            hoursAgo: 44.5,
          },
          {
            author: "kipronoLangat",
            body: "Parce que deux commandes peuvent avoir le même `created_at` à la milliseconde près. Sans l'`id`, tu perds celle qui tombe pile sur la frontière.",
            hoursAgo: 44,
          },
        ],
      },
      {
        author: "dapoOyelaran",
        body: "PSA : votre `/health` qui renvoie 200 sans toucher à la base, ce n'est pas un healthcheck, c'est un \"je suis allumé\".",
        hoursAgo: 20,
      },
    ],
    assistant: {
      askedBy: "skanderJaziri",
      question:
        "un client me demande pourquoi certains paiements sont comptés deux fois quand le réseau coupe. Je regarde quoi en premier ?",
      skillSlug: "paiement-mobile-idempotence",
      answer: [
        "Je m'appuie sur le skill paiement-mobile-idempotence.",
        "",
        "Trois vérifications, dans cet ordre :",
        "",
        "1. **Une clé d'idempotence fournie par le client** sur chaque demande de paiement. Si le téléphone renvoie la requête après une coupure, le serveur reconnaît la clé et ne déclenche pas un second mouvement d'argent.",
        "2. **Pas de crédit sur la seule foi d'un webhook.** Un webhook peut être rejoué ou arriver en double : revérifie le statut auprès de l'API de l'opérateur avant de créditer.",
        "3. **Un journal de chaque changement d'état** avec ce qui l'a déclenché. Pour expliquer un doublon à ton client, c'est la seule preuve utilisable.",
        "",
        "Si les doublons apparaissent seulement quand le réseau coupe, le point 1 est le premier suspect.",
      ].join("\n"),
      hoursAgo: 8,
    },
  },
  {
    space: "backend-api",
    channel: "performance",
    messages: [
      {
        author: "coumbaThiam",
        body: "Rappel du vendredi : `EXPLAIN ANALYZE` avant d'ajouter un index, pas après. On a supprimé trois index inutiles cette semaine, les écritures vont 15 % plus vite.",
        hoursAgo: 30,
        replies: [
          {
            author: "kgomotsoMahlangu",
            body: "Et `pg_stat_user_indexes` pour trouver ceux qu'aucune requête n'utilise. `idx_scan = 0` depuis trois mois, c'est un candidat.",
            hoursAgo: 29,
          },
        ],
      },
      {
        author: "eboQuansah",
        body: "Mon endpoint de relevé de compte passe de 80 ms à 4 s le 1er du mois. Tout le monde télécharge son relevé en même temps. Cache ou file d'attente ?",
        hoursAgo: 12,
        replies: [
          {
            author: "coumbaThiam",
            body: "Le relevé du mois dernier ne change plus : génère-le une fois la nuit du 1er et sers le fichier. Pas besoin d'être plus malin que ça.",
            hoursAgo: 11,
          },
        ],
      },
    ],
  },
  {
    space: "flutter-afrique",
    channel: "general",
    messages: [
      {
        author: "ahouKouadio",
        body: "Mon jeu tourne à 60 fps sur mon téléphone et à 25 sur celui de ma cousine. Même modèle, deux ans d'écart. Je deviens folle.",
        hoursAgo: 60,
        replies: [
          {
            author: "eboQuansah",
            body: "Mode économie d'énergie activé chez elle ? Sur certains Android ça bride le GPU sans rien dire.",
            hoursAgo: 59,
          },
          {
            author: "ahouKouadio",
            body: "...oui. Deux soirées perdues pour un interrupteur.",
            hoursAgo: 58,
          },
        ],
      },
      {
        author: "eboQuansah",
        body: "Pour ceux qui publient sur le Play Store depuis le continent : la vérification d'identité développeur m'a pris onze jours. Prévoyez large avant une démo.",
        hoursAgo: 34,
      },
      {
        author: "dapoOyelaran",
        body: "Riverpod ou Bloc pour une appli de 15 écrans maintenue par deux personnes ? Je ne veux pas d'une guerre de religion, juste votre vécu.",
        hoursAgo: 22,
        replies: [
          {
            author: "eboQuansah",
            body: "Riverpod. À deux, moins de cérémonie compte plus que la structure. Bloc devient intéressant quand l'équipe grossit et qu'il faut des règles que tout le monde suit.",
            hoursAgo: 21,
          },
        ],
      },
    ],
    assistant: {
      askedBy: "eboQuansah",
      question:
        "je prototype un petit jeu de cartes en Unity le soir, il saccade sur un Android d'entrée de gamme. Par où je commence ?",
      skillSlug: "frame-pacing-android-bas-de-gamme",
      answer: [
        "Je m'appuie sur le skill frame-pacing-android-bas-de-gamme.",
        "",
        "Commence par le vrai téléphone, pas l'émulateur : il cache presque toujours les limites thermiques du matériel. Ensuite :",
        "",
        "- fixe un budget par image (33 ms pour 30 images par seconde) et tiens-le ;",
        "- quand tu le dépasses, baisse d'abord les particules et les effets, la résolution en dernier : un joueur pardonne moins un flou soudain qu'un ralentissement ;",
        "- charge les images des cartes pendant les transitions entre parties, pas au moment où elles apparaissent.",
        "",
        "Une cadence stable à 30 paraît plus fluide qu'un 60 qui décroche.",
      ].join("\n"),
      hoursAgo: 15,
    },
  },
  {
    space: "flutter-afrique",
    channel: "aide-flutter",
    messages: [
      {
        author: "heritierKabeya",
        body: "Je dois afficher des mesures de capteurs dans une appli Flutter, en Bluetooth. `flutter_blue_plus` perd la connexion toutes les deux minutes. Une idée ?",
        hoursAgo: 26,
        replies: [
          {
            author: "eboQuansah",
            body: "Vérifie l'optimisation de batterie Android pour ton appli : elle coupe le Bluetooth en arrière-plan. Et demande l'exemption à l'utilisateur, avec une phrase qui explique pourquoi.",
            hoursAgo: 25,
          },
        ],
      },
    ],
  },
  {
    space: "carriere-freelance-tech",
    channel: "general",
    messages: [
      {
        author: "lynaBouzid",
        body: "Sondage pas scientifique : vous facturez au jour ou au forfait ? Je passe au forfait et j'ai peur de me faire avoir sur le périmètre.",
        hoursAgo: 80,
        replies: [
          {
            author: "skanderJaziri",
            body: "Forfait, mais avec une liste écrite de ce qui n'est PAS inclus. C'est cette liste qui me protège, pas celle de ce qui est inclus.",
            hoursAgo: 79,
          },
          {
            author: "dapoOyelaran",
            body: 'Et un prix pour "une série de retours en plus". Le client choisit en connaissance de cause, et personne ne s\'énerve.',
            hoursAgo: 78,
          },
        ],
      },
      {
        author: "ahouKouadio",
        body: "Je finis mes études en juin. Pour un premier poste, mieux vaut un portfolio de trois jeux finis ou un seul gros projet ?",
        hoursAgo: 40,
        replies: [
          {
            author: "coumbaThiam",
            body: "Trois petits projets finis. Un recruteur regarde d'abord si tu termines ce que tu commences. Le gros projet inachevé raconte l'inverse.",
            hoursAgo: 39,
          },
          {
            author: "kgomotsoMahlangu",
            body: "Et publie-les comme Travaux ici, avec ce que tu as appris. Le texte compte autant que la démo.",
            hoursAgo: 38,
          },
        ],
      },
      {
        author: "heritierKabeya",
        body: "Mon premier entretien technique, c'est demain. On m'a dit \"code en direct\". Des conseils pour ne pas paniquer ?",
        hoursAgo: 14,
        replies: [
          {
            author: "kipronoLangat",
            body: 'Parle pendant que tu réfléchis, même si c\'est "je ne sais pas encore, je regarde les cas limites". On évalue ta façon de chercher, rarement la réponse parfaite.',
            hoursAgo: 13,
          },
          {
            author: "skanderJaziri",
            body: "Et bois de l'eau. Sérieusement.",
            hoursAgo: 12.5,
          },
        ],
      },
    ],
    assistant: {
      askedBy: "lynaBouzid",
      question:
        "un client veut une appli web pour des agents de terrain qui perdent souvent le réseau. Qu'est-ce que je dois prévoir dans le devis ?",
      skillSlug: "ux-reseau-instable",
      answer: [
        "Je m'appuie sur le skill ux-reseau-instable.",
        "",
        "Trois postes qu'on oublie souvent dans un devis pour ce type d'utilisateurs :",
        "",
        "- **une file d'actions hors ligne** : l'agent saisit sans réseau, l'appli envoie à la reconnexion. C'est du travail en plus, à chiffrer à part ;",
        "- **des clés d'idempotence** sur chaque envoi critique, pour qu'un renvoi après coupure ne crée pas de doublon ;",
        "- **un état de connexion visible** : l'agent doit savoir que son action est en attente, sinon il la refait.",
        "",
        "Prévois aussi du temps de test sur un vrai réseau mobile faible, pas seulement dans le simulateur du navigateur.",
      ].join("\n"),
      hoursAgo: 6,
    },
  },
  {
    space: "carriere-freelance-tech",
    channel: "offres",
    messages: [
      {
        author: "kipronoLangat",
        body: "On cherche un ou une backend Java à Nairobi ou en remote sur un fuseau africain. Paiement mobile, Kafka, pas de diplôme exigé, un projet à montrer suffit. Écrivez-moi en privé.",
        hoursAgo: 18,
      },
    ],
  },
];

async function ensureMembers(db: DbOrTx, spaceId: string, profileIds: string[]): Promise<void> {
  await db
    .insert(spaceMembers)
    .values(profileIds.map((profileId) => ({ spaceId, profileId, role: "member" as const })))
    .onConflictDoNothing();
}

/**
 * Remplit trois espaces communautaires : questions de tous les jours, fils de
 * réponses et un échange enregistré avec @kemet qui cite un skill.
 */
export async function createSpaceThreads(
  db: DbOrTx,
  ids: DemoAccountIds,
  channelIds: CommunityChannelIds,
): Promise<void> {
  const [assistant] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.handle, ASSISTANT_HANDLE));
  if (!assistant)
    throw new Error("Profil système de l'assistant introuvable : migrations non appliquées ?");
  const skillSlugs = CHANNEL_CONTENT.flatMap((content) =>
    content.assistant ? [content.assistant.skillSlug] : [],
  );
  const skillRows = await db
    .select({ id: skills.id, slug: skills.slug })
    .from(skills)
    .where(inArray(skills.slug, skillSlugs));
  const skillIdBySlug = new Map(skillRows.map((row) => [row.slug, row.id]));

  for (const content of CHANNEL_CONTENT) {
    const channelId = channelIds.get(content.space)?.get(content.channel);
    if (!channelId)
      throw new Error(`Salon de démonstration introuvable : ${content.space}/${content.channel}`);
    const [channel] = await db
      .select({ spaceId: channels.spaceId })
      .from(channels)
      .where(eq(channels.id, channelId));

    const authors = new Set<AccountKey>();
    for (const message of content.messages) {
      authors.add(message.author);
      for (const reply of message.replies ?? []) authors.add(reply.author);
    }
    if (content.assistant) authors.add(content.assistant.askedBy);
    await ensureMembers(
      db,
      channel!.spaceId!,
      [...authors].map((key) => ids[key]),
    );

    for (const message of content.messages) {
      const [parent] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: ids[message.author],
          clientId: randomUUID(),
          body: message.body,
          createdAt: hoursAgo(message.hoursAgo),
        })
        .returning({ id: messages.id });
      if (message.replies?.length) {
        await db.insert(messages).values(
          message.replies.map((reply) => ({
            channelId,
            authorId: ids[reply.author],
            parentMessageId: parent!.id,
            clientId: randomUUID(),
            body: reply.body,
            createdAt: hoursAgo(reply.hoursAgo),
          })),
        );
      }
    }

    if (content.assistant) {
      const exchange = content.assistant;
      const skillId = skillIdBySlug.get(exchange.skillSlug);
      if (!skillId) throw new Error(`Skill de démonstration introuvable : ${exchange.skillSlug}`);
      const askedAt = hoursAgo(exchange.hoursAgo);
      const answeredAt = hoursAgo(exchange.hoursAgo - RESPONSE_DELAY_HOURS);
      const [trigger] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: ids[exchange.askedBy],
          clientId: randomUUID(),
          body: `@kemet ${exchange.question}`,
          createdAt: askedAt,
        })
        .returning({ id: messages.id });
      const [response] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: assistant.id,
          clientId: randomUUID(),
          body: exchange.answer,
          createdAt: answeredAt,
        })
        .returning({ id: messages.id });
      await db.insert(assistantInvocations).values({
        channelId,
        triggerMessageId: trigger!.id,
        requestedBy: ids[exchange.askedBy],
        responseMessageId: response!.id,
        skillIds: [skillId],
        status: "done",
        recorded: true,
        helpful: null,
        createdAt: askedAt,
        completedAt: answeredAt,
      });
    }
  }
}
