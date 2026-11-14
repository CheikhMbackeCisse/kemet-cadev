import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { postAttachments, posts, spacePinnedPosts, spaces } from "../schema/index.js";
import { demoUuid } from "./demo-uuid.js";
import { storePostImage } from "./demo-media.js";
import { ensureSystalinkMembership, ensureSystalinkProfile, SYSTALINK_PROFILE_ID } from "./systalink.js";
import { hoursAgo } from "./time.js";

/**
 * Les six visuels de la publication Instagram de Systalink, organisatrice de
 * la CADEV 2026, repris tels quels avec son accord (seules images du seed qui
 * ne soient pas fabriquées par nous) : voir THIRD_PARTY_LICENSES.md. Les PNG
 * sont les sources, les WebP de qualité 85 sont ceux qu'on affiche.
 */
export const CADEV_ASSETS_DIR = fileURLToPath(
  new URL("../../seed-assets/cadev/carrousel/", import.meta.url),
);

const CADEV_SPACE_SLUG = "cadev-2026";
const POST_ID = demoUuid("post:cadev-en-bref");

export const CADEV_POST_BODY =
  "**La CADEV 2026 en bref**\n\n" +
  "La Coupe d'Afrique des Développeurs réunit des développeurs de tout le continent autour d'un même " +
  "défi : construire une solution utile, en équipe. À la clé, 5 millions de FCFA pour l'équipe gagnante.";

/** Visuels dans l'ordre de la publication, avec leur texte comme texte alternatif. */
export const CADEV_SLIDES: ReadonlyArray<{ file: string; alt: string }> = [
  {
    file: "systalink-cadev-01.webp",
    alt: "CADEV 2026, Coupe d'Afrique des développeurs. 5 000 développeurs africains codent la même chose en ce moment. Toi, tu scrolles.",
  },
  {
    file: "systalink-cadev-02.webp",
    alt: "Ce n'est pas un hackathon de plus. C'est la construction de la plateforme où les devs africains vont se retrouver, s'entraider et se faire repérer.",
  },
  {
    file: "systalink-cadev-03.webp",
    alt: "Pensée par des devs africains. Codée par des devs africains. Pour les devs africains. Pas par une boîte de la Silicon Valley qui découvre qu'on existe.",
  },
  {
    file: "systalink-cadev-04.webp",
    alt: "Dakar, Abidjan, Lomé, Kinshasa, Casablanca… Plus de 42 pays. 5 000+ développeurs. Un seul objectif.",
  },
  {
    file: "systalink-cadev-05.webp",
    alt: "Dans quelques mois, des milliers de devs vont l'utiliser. Une question : est-ce que tu veux être celui ou celle qui l'a construite, ou juste un utilisateur ?",
  },
  {
    file: "systalink-cadev-06.webp",
    alt: "5 000 000 FCFA pour l'équipe gagnante. Et ton nom sur la plateforme de tout un continent.",
  },
];

/**
 * Post "La CADEV 2026 en bref", publié par Systalink dans l'espace CADEV 2026
 * et épinglé en tête de ses salons, avec ses six visuels en carrousel.
 * Relançable : un post publié auparavant par un compte de démonstration passe
 * à Systalink, et les images sont remplacées seulement quand la liste des
 * visuels a changé. Le post vient du compte Systalink : aucun crédit dessous.
 * Rien n'est fait si l'espace n'a pas été créé par un compte de démonstration,
 * ni si l'identifiant systalink est porté par un autre profil.
 */
export async function seedCadevPost(
  db: DbOrTx,
  ids: Map<string, string>,
  uploadsDir: string,
  assetsDir: string = CADEV_ASSETS_DIR,
): Promise<string> {
  const [space] = await db
    .select({ id: spaces.id, createdBy: spaces.createdBy })
    .from(spaces)
    .where(eq(spaces.slug, CADEV_SPACE_SLUG));
  if (!space || ![...ids.values()].includes(space.createdBy)) return "espace absent";

  const [existing] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, POST_ID));
  const demoAuthors = new Set([...ids.values(), SYSTALINK_PROFILE_ID]);
  if (existing && !demoAuthors.has(existing.authorId)) return "identifiant pris";
  const authorId = await ensureSystalinkProfile(db);
  if (!authorId) return "identifiant systalink pris";
  await ensureSystalinkMembership(db, space.id);

  const content = {
    authorId,
    spaceId: space.id,
    body: CADEV_POST_BODY,
    mediaCredit: null,
    mediaCreditUrl: null,
  };
  if (existing) {
    await db.update(posts).set(content).where(eq(posts.id, POST_ID));
    await db.update(postAttachments).set({ authorId }).where(eq(postAttachments.postId, POST_ID));
  } else {
    await db.insert(posts).values({ id: POST_ID, createdAt: hoursAgo(72), ...content });
  }

  const images = CADEV_SLIDES.map((slide) => slide.file);
  const usages = images.map((image) => `cadev:${image}`);
  const current = await db
    .select({ id: postAttachments.id, storageKey: postAttachments.storageKey })
    .from(postAttachments)
    .where(eq(postAttachments.postId, POST_ID))
    .orderBy(asc(postAttachments.position));
  const wantedKeys = images.map((image, index) => demoUuid(`file:${usages[index]}:${image}`));
  const unchanged =
    current.length === wantedKeys.length && current.every((row, index) => row.storageKey === wantedKeys[index]);
  if (!unchanged) {
    if (current.length > 0) {
      await db.delete(postAttachments).where(
        inArray(
          postAttachments.id,
          current.map((row) => row.id),
        ),
      );
      for (const row of current) {
        if (!wantedKeys.includes(row.storageKey)) await rm(join(uploadsDir, row.storageKey), { force: true });
      }
    }
    for (const [position, image] of images.entries()) {
      const stored = await storePostImage(uploadsDir, assetsDir, image, usages[position]!);
      await db.insert(postAttachments).values({
        postId: POST_ID,
        authorId,
        position,
        ...stored,
        originalName: CADEV_SLIDES[position]!.alt,
      });
    }
  }

  await db
    .insert(spacePinnedPosts)
    .values({ spaceId: space.id, postId: POST_ID })
    .onConflictDoNothing({ target: spacePinnedPosts.spaceId });
  const [pin] = await db
    .select({ postId: spacePinnedPosts.postId })
    .from(spacePinnedPosts)
    .where(and(eq(spacePinnedPosts.spaceId, space.id), eq(spacePinnedPosts.postId, POST_ID)));
  return pin ? `${images.length} image(s), épinglé` : `${images.length} image(s), autre post épinglé`;
}
