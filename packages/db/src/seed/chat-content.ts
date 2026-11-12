import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { channels, messages, profiles, spaceMembers, spaces } from "../schema/index.js";
import type { DemoAccountIds } from "./accounts.js";
import { hoursAgo } from "./time.js";

const CADEV_SPACE_SLUG = "cadev-2026";
export const CADEV_SPACE_DESCRIPTION = "Espace d'échange autour de la CADEV 2026.";
export const CADEV_WELCOME_OPENING =
  "Bienvenue dans cet espace d'échange autour de la CADEV 2026 !";
// Textes des premières versions du seed : un espace de démonstration ne se
// présente pas comme celui de l'organisateur.
const OLD_CADEV_DESCRIPTION =
  "Espace officiel de la compétition CADEV 2026, organisée par Systalink.";
const OLD_CADEV_WELCOME_OPENING = "Bienvenue sur l'espace officiel de CADEV 2026 !";

/**
 * Remplace les anciens textes de l'espace CADEV 2026 sur une base déjà
 * remplie. Ne touche que la description d'origine et le message d'accueil
 * d'un compte de démonstration.
 */
export async function renameCadevSpace(db: DbOrTx): Promise<{ spaces: number; messages: number }> {
  const renamedSpaces = await db
    .update(spaces)
    .set({ description: CADEV_SPACE_DESCRIPTION })
    .where(and(eq(spaces.slug, CADEV_SPACE_SLUG), eq(spaces.description, OLD_CADEV_DESCRIPTION)))
    .returning({ id: spaces.id });

  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(eq(spaces.slug, CADEV_SPACE_SLUG));
  if (!space) return { spaces: renamedSpaces.length, messages: 0 };
  const welcome = await db
    .select({ id: messages.id, body: messages.body })
    .from(messages)
    .innerJoin(channels, eq(channels.id, messages.channelId))
    .innerJoin(profiles, eq(profiles.id, messages.authorId))
    .where(
      and(
        eq(channels.spaceId, space.id),
        eq(profiles.isDemo, true),
        like(messages.body, `${OLD_CADEV_WELCOME_OPENING}%`),
      ),
    );
  for (const message of welcome) {
    await db
      .update(messages)
      .set({ body: CADEV_WELCOME_OPENING + message.body.slice(OLD_CADEV_WELCOME_OPENING.length) })
      .where(eq(messages.id, message.id));
  }
  return { spaces: renamedSpaces.length, messages: welcome.length };
}

// Public et rempli de messages, pour que la plateforme ne paraisse pas vide
// à la première visite.
export async function createCadevSpace(
  db: DbOrTx,
  accountIds: DemoAccountIds,
): Promise<{ generalChannelId: string }> {
  const [cadevSpace] = await db
    .insert(spaces)
    .values({
      name: "CADEV 2026",
      slug: "cadev-2026",
      description: CADEV_SPACE_DESCRIPTION,
      visibility: "public",
      createdBy: accountIds.coumbaThiam,
    })
    .returning({ id: spaces.id });
  const cadevSpaceId = cadevSpace!.id;

  const memberKeys = Object.keys(accountIds) as (keyof DemoAccountIds)[];
  await db.insert(spaceMembers).values(
    memberKeys.map((key) => ({
      spaceId: cadevSpaceId,
      profileId: accountIds[key],
      role: key === "coumbaThiam" ? ("owner" as const) : ("member" as const),
    })),
  );

  // Mêmes salons que DEFAULT_CHANNELS, côté serveur.
  const [generalChannel, memesChannel] = await db
    .insert(channels)
    .values([
      { spaceId: cadevSpaceId, name: "général", slug: "general", displayOrder: 0 },
      { spaceId: cadevSpaceId, name: "mèmes", slug: "memes", displayOrder: 1 },
    ])
    .returning({ id: channels.id });

  await db.insert(messages).values([
    {
      channelId: generalChannel!.id,
      authorId: accountIds.coumbaThiam,
      clientId: randomUUID(),
      body:
        `${CADEV_WELCOME_OPENING} Posez vos questions, partagez vos skills, ` +
        "et n'hésitez pas à utiliser @kocc si vous bloquez sur quelque chose.",
      createdAt: hoursAgo(96),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.eboQuansah,
      clientId: randomUUID(),
      body: "Quelqu'un a une astuce pour la synchronisation hors-ligne sur Flutter ? Mon cache local part en vrille dès qu'il y a un conflit d'écriture.",
      createdAt: hoursAgo(90),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.kipronoLangat,
      clientId: randomUUID(),
      body:
        "On a eu le même souci côté paiement mobile : résoudre les conflits par horodatage serveur, jamais par " +
        "horodatage client, règle ça la plupart du temps. Chez nous ça tient en quelques lignes :\n\n" +
        "```dart\n" +
        "PendingWrite resolve(PendingWrite local, PendingWrite remote) {\n" +
        "  // L'horloge du téléphone peut mentir, celle du serveur fait foi.\n" +
        "  return remote.serverUpdatedAt.isAfter(local.serverUpdatedAt) ? remote : local;\n" +
        "}\n" +
        "```",
      createdAt: hoursAgo(89),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.lynaBouzid,
      clientId: randomUUID(),
      body: "Côté CI, j'ai mis un skill en ligne sur les images Docker qui timeout aléatoirement sur les runners partagés. Ça m'a fait gagner des heures.",
      createdAt: hoursAgo(72),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.dapoOyelaran,
      clientId: randomUUID(),
      body: "Quelqu'un ici a déjà fait un design system en React pour une app fintech ? Je cherche des retours sur la gestion des thèmes clair/sombre.",
      createdAt: hoursAgo(50),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.coumbaThiam,
      clientId: randomUUID(),
      body: "J'ai publié un skill sur l'intégration Wave côté serveur (webhooks, remboursements) si ça peut servir à ceux qui touchent au paiement mobile.",
      createdAt: hoursAgo(48),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.ghizlaneAmrani,
      clientId: randomUUID(),
      body: "Je travaille sur un modèle de recommandation en arabe dialectal, très peu de corpus disponibles. Si quelqu'un a des pistes côté NLP bas-ressource, je suis preneuse.",
      createdAt: hoursAgo(30),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.kgomotsoMahlangu,
      clientId: randomUUID(),
      body: "Pour ceux qui galèrent avec Airflow : surveillez la mémoire de vos workers, pas seulement les logs des tâches. Un worker qui OOM silencieusement fait planter toute la DAG sans message clair.",
      createdAt: hoursAgo(24),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.heritierKabeya,
      clientId: randomUUID(),
      body: "Firmware pour capteurs agricoles connectés en zone rurale : la vraie contrainte, c'est l'autonomie batterie, pas la puissance de calcul. On sacrifie toujours la fréquence de mesure en premier.",
      createdAt: hoursAgo(10),
    },
    {
      channelId: generalChannel!.id,
      authorId: accountIds.ahouKouadio,
      clientId: randomUUID(),
      body: "Qui d'autre soumet un projet pour CADEV cette année ? On est à quelques jours de la clôture, ça devient sérieux.",
      createdAt: hoursAgo(4),
    },
  ]);

  await db.insert(messages).values([
    {
      channelId: memesChannel!.id,
      authorId: accountIds.skanderJaziri,
      clientId: randomUUID(),
      body: "Le code qui marche en local et qui s'écroule dès que ça touche la CI, un classique indémodable.",
      createdAt: hoursAgo(80),
    },
    {
      channelId: memesChannel!.id,
      authorId: accountIds.lynaBouzid,
      clientId: randomUUID(),
      body: '"Ça compile, donc ça marche" — phrase la plus dangereuse du métier.',
      createdAt: hoursAgo(55),
    },
    {
      channelId: memesChannel!.id,
      authorId: accountIds.eboQuansah,
      clientId: randomUUID(),
      body: "Jour de démo : le seul moment où le wifi de la salle décide de ne plus exister.",
      createdAt: hoursAgo(6),
    },
  ]);

  return { generalChannelId: generalChannel!.id };
}
