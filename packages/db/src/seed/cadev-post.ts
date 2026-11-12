import { readdir, rm } from "node:fs/promises";
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
 * Visuel promotionnel de Systalink, organisatrice de la CADEV 2026, repris
 * tel quel avec son accord (seule image du seed qui ne soit pas fabriquée
 * par nous) : voir THIRD_PARTY_LICENSES.md.
 */
export const CADEV_ASSETS_DIR = fileURLToPath(new URL("../../seed-assets/cadev/", import.meta.url));

const CADEV_SPACE_SLUG = "cadev-2026";
const POST_ID = demoUuid("post:cadev-en-bref");
const COVER = "cadev-couverture.jpg";
const NUMBERED = /^cadev-(\d+)\.(jpe?g|png|webp)$/i;

export const CADEV_POST_BODY =
  "**La CADEV 2026 en bref**\n\n" +
  "La Coupe d'Afrique des Développeurs réunit des développeurs de tout le continent autour d'un même " +
  "défi : construire une solution utile, en équipe. À la clé, 5 millions de FCFA pour l'équipe gagnante.";

export const CADEV_MEDIA_CREDIT = "Visuel : Systalink";
export const CADEV_MEDIA_CREDIT_URL = "https://www.instagram.com/systalink/p/DewrHGNjtTM/";

/**
 * Images du post : la couverture d'abord, puis `cadev-1`, `cadev-2`... dans
 * l'ordre de leur numéro s'il y en a dans le dossier (carrousel).
 */
export async function cadevImages(dir: string = CADEV_ASSETS_DIR): Promise<string[]> {
  const numbered = (await readdir(dir))
    .map((name) => ({ name, match: NUMBERED.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
    .map((entry) => entry.name);
  return [COVER, ...numbered];
}

/**
 * Post "La CADEV 2026 en bref", publié par Systalink dans l'espace CADEV 2026
 * et épinglé en tête de ses salons. Relançable : un post publié auparavant
 * par un compte de démonstration passe à Systalink, et les images sont
 * remplacées seulement quand la liste des fichiers du dossier a changé.
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
    mediaCredit: CADEV_MEDIA_CREDIT,
    mediaCreditUrl: CADEV_MEDIA_CREDIT_URL,
  };
  if (existing) {
    await db.update(posts).set(content).where(eq(posts.id, POST_ID));
    await db.update(postAttachments).set({ authorId }).where(eq(postAttachments.postId, POST_ID));
  } else {
    await db.insert(posts).values({ id: POST_ID, createdAt: hoursAgo(72), ...content });
  }

  const images = await cadevImages(assetsDir);
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
      await db.insert(postAttachments).values({ postId: POST_ID, authorId, position, ...stored });
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
