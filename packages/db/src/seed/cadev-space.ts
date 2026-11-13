import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  channels,
  feedPinnedPosts,
  messages,
  postReplies,
  postReposts,
  posts,
  profiles,
  spaceMembers,
  spaces,
} from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { topUpHearts } from "./showcase.js";
import { hoursAgo } from "./time.js";

// Salons de l'espace CADEV 2026. Les seules informations sur la compétition
// sont les dates publiées par Systalink ; pour tout le reste, les messages
// renvoient au post de Systalink plutôt que d'inventer une règle.

const CADEV_SPACE_SLUG = "cadev-2026";
const CADEV_POST_ID = demoUuid("post:cadev-en-bref");
const WAVE_POST_ID = demoUuid("showcase-post:wave-webhook-question");
const CADEV_POST_HEARTS = 1213;
const CADEV_POST_REPOSTS = 97;
const MINUTE_MS = 60 * 1000;

const CHANNELS = [
  { key: "annonces", name: "annonces", order: 0 },
  { key: "trouver-une-equipe", name: "trouver-une-équipe", order: 1 },
  { key: "reglement-et-dates", name: "règlement-et-dates", order: 2 },
  { key: "entraide-technique", name: "entraide-technique", order: 3 },
  { key: "presentations", name: "présentations", order: 4 },
] as const;

/** Les deux salons d'origine passent après les salons de la compétition, sans être supprimés. */
const LEGACY_CHANNEL_ORDER = [
  { slug: "general", order: 5 },
  { slug: "memes", order: 6 },
] as const;

type ChannelKey = (typeof CHANNELS)[number]["key"];

interface CadevMessage {
  key: string;
  channel: ChannelKey;
  authorHandle: string;
  hoursAgo: number;
  body: string;
}

export const CADEV_MESSAGES: CadevMessage[] = [
  {
    key: "an1",
    channel: "annonces",
    authorHandle: "coumba-thiam",
    hoursAgo: 70,
    body:
      "Les dates à retenir : soumission le 15/11 à 17 h GMT, vote des pairs les 15 et 16/11, " +
      "vote public du 17 au 20/11, résultats le 23/11. Tout le reste est dans le post de Systalink " +
      "épinglé en haut des salons.",
  },
  {
    key: "an2",
    channel: "annonces",
    authorHandle: "coumba-thiam",
    hoursAgo: 30,
    body:
      "Pour les fuseaux : 17 h GMT, c'est 17 h à Dakar, Abidjan et Accra, 18 h à Lagos, Alger et " +
      "Tunis, 19 h à Johannesburg et Lubumbashi, 20 h à Nairobi.",
  },
  {
    key: "an3",
    channel: "annonces",
    authorHandle: "kiprono-langat",
    hoursAgo: 8,
    body:
      "Conseil d'ancien : n'attendez pas le 15/11 à 16 h 59 pour déposer. Une connexion qui lâche " +
      "à la dernière minute, ça arrive à tout le monde.",
  },
  {
    key: "eq1",
    channel: "trouver-une-equipe",
    authorHandle: "coumba-thiam",
    hoursAgo: 66,
    body:
      "On est deux à Dakar, il nous manque une personne front. Projet : suivi des cotisations " +
      "d'une tontine, en React. Quelqu'un ?",
  },
  {
    key: "eq2",
    channel: "trouver-une-equipe",
    authorHandle: "dapo-oyelaran",
    hoursAgo: 64,
    body: "Je peux faire le front depuis Lagos. React et TypeScript, j'ai déjà fait un tableau de cotisations.",
  },
  {
    key: "eq3",
    channel: "trouver-une-equipe",
    authorHandle: "coumba-thiam",
    hoursAgo: 63,
    body: "Parfait, je t'écris en privé.",
  },
  {
    key: "eq4",
    channel: "trouver-une-equipe",
    authorHandle: "ahou-kouadio",
    hoursAgo: 50,
    body:
      "Étudiante à Yamoussoukro, je fais surtout des jeux en Flutter. Je cherche une équipe, je " +
      "peux prendre les écrans et les tests.",
  },
  {
    key: "eq5",
    channel: "trouver-une-equipe",
    authorHandle: "ebo-quansah",
    hoursAgo: 48,
    body:
      "Viens avec nous, Ahou. On est en Flutter avec Héritier, sur un relevé de compteurs d'eau. " +
      "Il nous manque justement quelqu'un pour les écrans.",
  },
  {
    key: "eq6",
    channel: "trouver-une-equipe",
    authorHandle: "heritier-kabeya",
    hoursAgo: 47,
    body: "Confirmé, bienvenue dans l'équipe. Je m'occupe du capteur, vous de l'appli.",
  },
  {
    key: "eq7",
    channel: "trouver-une-equipe",
    authorHandle: "ghizlane-amrani",
    hoursAgo: 26,
    body:
      "Je cherche une personne backend pour un outil de transcription de réunions en darija. " +
      "La partie NLP, je m'en charge.",
  },
  {
    key: "eq8",
    channel: "trouver-une-equipe",
    authorHandle: "skander-jaziri",
    hoursAgo: 24,
    body: "Partant depuis Sfax. Node ou Go, comme tu préfères.",
  },
  {
    key: "rd1",
    channel: "reglement-et-dates",
    authorHandle: "lyna-bouzid",
    hoursAgo: 58,
    body: "La vidéo de présentation, il y a une durée maximale ? Et on la dépose où ?",
  },
  {
    key: "rd2",
    channel: "reglement-et-dates",
    authorHandle: "kiprono-langat",
    hoursAgo: 57,
    body:
      "Je ne veux pas te dire de bêtise : tout ce qui touche au dépôt et à la vidéo est dans le " +
      "post de Systalink épinglé. C'est lui qui fait foi.",
  },
  {
    key: "rd3",
    channel: "reglement-et-dates",
    authorHandle: "kgomotso-mahlangu",
    hoursAgo: 40,
    body: "Le vote des pairs, c'est bien les 15 et 16/11 ? Juste après la soumission ?",
  },
  {
    key: "rd4",
    channel: "reglement-et-dates",
    authorHandle: "coumba-thiam",
    hoursAgo: 39,
    body: "Oui : soumission le 15/11 à 17 h GMT, vote des pairs les 15 et 16/11, puis vote public du 17 au 20/11.",
  },
  {
    key: "rd5",
    channel: "reglement-et-dates",
    authorHandle: "heritier-kabeya",
    hoursAgo: 22,
    body: "Le dépôt doit être public ou on peut le garder privé ?",
  },
  {
    key: "rd6",
    channel: "reglement-et-dates",
    authorHandle: "kiprono-langat",
    hoursAgo: 21,
    body:
      "Aucune idée, je préfère ne pas deviner. Vérifie dans le post de Systalink, et sinon pose " +
      "la question directement à Systalink.",
  },
  {
    key: "et1",
    channel: "entraide-technique",
    authorHandle: "ebo-quansah",
    hoursAgo: 55,
    body:
      "Notre build Flutter web fait 3 Mo et met dix secondes à s'afficher en 3G. Des idées avant " +
      "la démo ?",
  },
  {
    key: "et2",
    channel: "entraide-technique",
    authorHandle: "dapo-oyelaran",
    hoursAgo: 54,
    body:
      "Active Brotli ou gzip sur le serveur, sers les polices toi-même au lieu de Google Fonts, " +
      "et précharge seulement la première. Ça change déjà beaucoup.",
  },
  {
    key: "et3",
    channel: "entraide-technique",
    authorHandle: "lyna-bouzid",
    hoursAgo: 34,
    body:
      "Pensez aux healthchecks dans votre docker compose. Le jour de la démo, un service qui " +
      "démarre avant la base, c'est l'écran blanc garanti.",
  },
  {
    key: "et4",
    channel: "entraide-technique",
    authorHandle: "skander-jaziri",
    hoursAgo: 18,
    body: "Mon webhook Wave refuse toutes les signatures, alors que le secret est le bon. Quelqu'un a déjà eu ça ?",
  },
  {
    key: "et5",
    channel: "entraide-technique",
    authorHandle: "coumba-thiam",
    hoursAgo: 17,
    body:
      "Calcule le HMAC sur le corps brut, avant tout parsing JSON. Il y a un skill Wave et une " +
      "question en tête du fil qui expliquent exactement ce cas.",
  },
  {
    key: "et6",
    channel: "entraide-technique",
    authorHandle: "skander-jaziri",
    hoursAgo: 16,
    body: "C'était ça. Merci !",
  },
  {
    key: "et7",
    channel: "entraide-technique",
    authorHandle: "kgomotso-mahlangu",
    hoursAgo: 9,
    body:
      "Petit conseil pour les démos avec des chiffres : affichez toujours l'unité. « 42 » ne dit " +
      "rien au jury, « 42 litres » si.",
  },
  {
    key: "pr1",
    channel: "presentations",
    authorHandle: "heritier-kabeya",
    hoursAgo: 69,
    body: "Héritier, firmware ESP32 à Lubumbashi. Première CADEV pour moi.",
  },
  {
    key: "pr2",
    channel: "presentations",
    authorHandle: "ahou-kouadio",
    hoursAgo: 52,
    body: "Ahou, étudiante à Yamoussoukro. Je fais des jeux et j'apprends le backend.",
  },
  {
    key: "pr3",
    channel: "presentations",
    authorHandle: "kgomotso-mahlangu",
    hoursAgo: 44,
    body: "Kgomotso, data et tableaux de bord, depuis Johannesburg.",
  },
  {
    key: "pr4",
    channel: "presentations",
    authorHandle: "ghizlane-amrani",
    hoursAgo: 28,
    body: "Ghizlane, doctorante en NLP au Maroc. Je travaille sur la darija.",
  },
  {
    key: "pr5",
    channel: "presentations",
    authorHandle: "lyna-bouzid",
    hoursAgo: 27,
    body: "Lyna, DevOps freelance en Algérie. Je peux relire vos déploiements si besoin.",
  },
  {
    key: "pr6",
    channel: "presentations",
    authorHandle: "ebo-quansah",
    hoursAgo: 12,
    body: "Ebo, Flutter à Kumasi. Content de voir autant de monde ici.",
  },
];

interface CadevPostReply {
  key: string;
  authorHandle: string;
  /** Minutes après la publication du post. */
  minutesAfter: number;
  body: string;
}

export const CADEV_POST_REPLIES: CadevPostReply[] = [
  { key: "r1", authorHandle: "dapo-oyelaran", minutesAfter: 12, body: "Inscrits !" },
  {
    key: "r2",
    authorHandle: "ahou-kouadio",
    minutesAfter: 40,
    body: "Qui cherche une équipe à Abidjan ? Je descends de Yamoussoukro le week-end.",
  },
  {
    key: "r3",
    authorHandle: "kgomotso-mahlangu",
    minutesAfter: 95,
    body: "Le vote des pairs c'est obligatoire pour toute l'équipe ?",
  },
  {
    key: "r4",
    authorHandle: "kiprono-langat",
    minutesAfter: 110,
    body:
      "Il a lieu les 15 et 16/11. Pour savoir qui doit voter dans l'équipe, le mieux est de " +
      "demander directement à Systalink.",
  },
  {
    key: "r5",
    authorHandle: "skander-jaziri",
    minutesAfter: 180,
    body: "On part sur un outil de devis pour les artisans de Sfax. Rendez-vous le 23/11 !",
  },
  {
    key: "r6",
    authorHandle: "ghizlane-amrani",
    minutesAfter: 300,
    body: "5 millions de FCFA, ça motive…",
  },
  {
    key: "r7",
    authorHandle: "heritier-kabeya",
    minutesAfter: 420,
    body: "Première participation, et déjà une équipe. On y va.",
  },
  {
    key: "r8",
    authorHandle: "ebo-quansah",
    minutesAfter: 600,
    body: "17 h GMT le 15/11, ça fait 17 h à Accra aussi.",
  },
];

const AUTHOR_HANDLES = [
  ...new Set([
    ...CADEV_MESSAGES.map((message) => message.authorHandle),
    ...CADEV_POST_REPLIES.map((reply) => reply.authorHandle),
  ]),
];

export interface CadevSpaceResult {
  status: "done" | "skipped";
  reason?: string;
  messages: number;
  replies: number;
}

function channelId(key: ChannelKey): string {
  return demoUuid(`channel-cadev-${key}`);
}

async function topUpReposts(db: DbOrTx, postId: string, target: number): Promise<void> {
  const reposts = await db
    .select({ profileId: postReposts.profileId })
    .from(postReposts)
    .where(eq(postReposts.postId, postId));
  const missing = target - reposts.length;
  if (missing <= 0) return;
  const reposted = reposts.map((repost) => repost.profileId);
  const fillers = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.isFiller, true),
        reposted.length > 0 ? notInArray(profiles.id, reposted) : undefined,
      ),
    )
    .orderBy(asc(profiles.id))
    .limit(missing);
  if (fillers.length === 0) return;
  await db
    .insert(postReposts)
    .values(fillers.map((filler) => ({ postId, profileId: filler.id })))
    .onConflictDoNothing();
}

async function seedCadevPost(
  db: DbOrTx,
  ids: Map<string, string>,
): Promise<{ replies: number; pinned: boolean }> {
  const [cadevPost] = await db
    .select({ createdAt: posts.createdAt })
    .from(posts)
    .where(eq(posts.id, CADEV_POST_ID));
  if (!cadevPost) return { replies: 0, pinned: false };

  const [wavePost] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, WAVE_POST_ID));
  await db
    .insert(feedPinnedPosts)
    .values([
      { postId: CADEV_POST_ID, position: 0 },
      ...(wavePost ? [{ postId: WAVE_POST_ID, position: 1 }] : []),
    ])
    .onConflictDoNothing();

  await topUpHearts(db, CADEV_POST_ID, CADEV_POST_HEARTS);
  await topUpReposts(db, CADEV_POST_ID, CADEV_POST_REPOSTS);

  const latest = Date.now() - MINUTE_MS;
  const inserted = await db
    .insert(postReplies)
    .values(
      CADEV_POST_REPLIES.map((reply) => ({
        id: demoUuid(`cadev-post-reply:${reply.key}`),
        postId: CADEV_POST_ID,
        authorId: ids.get(reply.authorHandle)!,
        body: reply.body,
        createdAt: new Date(
          Math.min(cadevPost.createdAt.getTime() + reply.minutesAfter * MINUTE_MS, latest),
        ),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: postReplies.id });
  return { replies: inserted.length, pinned: true };
}

/**
 * Salons de la compétition dans l'espace CADEV 2026, messages entre comptes
 * de démonstration, post de Systalink et question Wave épinglés en tête du
 * fil. Relançable : rien n'est ajouté deux fois, rien n'est supprimé.
 */
export async function seedCadevSpace(db: DbOrTx): Promise<CadevSpaceResult> {
  // Un espace qu'une personne réelle aurait créé sous ce slug n'est jamais touché.
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .innerJoin(profiles, eq(profiles.id, spaces.createdBy))
    .where(and(eq(spaces.slug, CADEV_SPACE_SLUG), eq(profiles.isDemo, true)));
  if (!space)
    return {
      status: "skipped",
      reason: "espace CADEV 2026 absent ou créé hors démonstration",
      messages: 0,
      replies: 0,
    };

  const authors = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(and(inArray(profiles.handle, AUTHOR_HANDLES), eq(profiles.isDemo, true)));
  const ids = new Map(authors.map((row) => [row.handle, row.id]));
  if (ids.size !== AUTHOR_HANDLES.length)
    return {
      status: "skipped",
      reason: "comptes de démonstration absents",
      messages: 0,
      replies: 0,
    };

  return db.transaction(async (tx) => {
    await tx
      .insert(channels)
      .values(
        CHANNELS.map((channel) => ({
          id: channelId(channel.key),
          spaceId: space.id,
          name: channel.name,
          slug: channel.key,
          displayOrder: channel.order,
        })),
      )
      .onConflictDoNothing();
    for (const legacy of LEGACY_CHANNEL_ORDER) {
      await tx
        .update(channels)
        .set({ displayOrder: legacy.order })
        .where(and(eq(channels.spaceId, space.id), eq(channels.slug, legacy.slug)));
    }

    await tx
      .insert(spaceMembers)
      .values(
        [...ids.values()].map((profileId) => ({
          spaceId: space.id,
          profileId,
          role: "member" as const,
        })),
      )
      .onConflictDoNothing();

    // Un salon du même nom créé à la main garde sa place : ses messages ne sont pas ajoutés.
    const seeded = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.spaceId, space.id),
          inArray(
            channels.id,
            CHANNELS.map((channel) => channelId(channel.key)),
          ),
        ),
      );
    const seededIds = new Set(seeded.map((row) => row.id));
    const toInsert = CADEV_MESSAGES.filter((message) => seededIds.has(channelId(message.channel)));
    const inserted =
      toInsert.length === 0
        ? []
        : await tx
            .insert(messages)
            .values(
              toInsert.map((message) => ({
                channelId: channelId(message.channel),
                authorId: ids.get(message.authorHandle)!,
                clientId: `demo-cadev-${message.key}`,
                body: message.body,
                createdAt: hoursAgo(message.hoursAgo),
              })),
            )
            .onConflictDoNothing()
            .returning({ id: messages.id });

    const post = await seedCadevPost(tx, ids);
    return { status: "done", messages: inserted.length, replies: post.replies };
  });
}
