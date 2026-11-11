import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, count, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import {
  assistantInvocations,
  postAttachments,
  posts,
  profiles,
  skillRatings,
  skills,
  workMedia,
  works,
} from "../schema/index.js";
import { DEMO_ACCOUNTS } from "./accounts.js";
import { chunk } from "./chunk.js";
import {
  DEMO_ASSET_NAMES,
  DEMO_EXISTING_POST_IMAGES,
  DEMO_MEDIA_POSTS,
  DEMO_SKILL_TARGETS,
  DEMO_WORK_MEDIA,
} from "./demo-media-content.js";
import { demoUuid } from "./demo-uuid.js";
import { seededShuffle } from "./filler-profiles.js";
import { daysAgo, hoursAgo } from "./time.js";

/** Fichiers générés par seed-assets/render.ts, livrés avec le paquet. */
export const DEMO_ASSETS_DIR = fileURLToPath(new URL("../../seed-assets/out/", import.meta.url));

const INSERT_BATCH = 1_000;

export type DemoMediaResult =
  | { status: "skipped"; reason: string }
  | {
      status: "done";
      banners: number;
      posts: number;
      postImages: number;
      works: number;
      skillUses: number;
      skillRatings: number;
      filesWritten: boolean;
    };

interface StoredFile {
  storageKey: string;
  mimeType: string;
  originalName: string;
  byteSize: number;
}

const MIME_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".webm": "video/webm" };

// Clé de stockage dérivée de l'usage du fichier : relancer le seed réécrit le
// même fichier au lieu d'en laisser un orphelin si la transaction échoue.
async function storeAsset(
  uploadsDir: string,
  assetsDir: string,
  asset: string,
  usage: string,
): Promise<StoredFile> {
  const mimeType = MIME_TYPES[extname(asset)];
  if (!mimeType) throw new Error(`Type de fichier de démonstration inconnu : ${asset}`);
  const storageKey = demoUuid(`file:${usage}:${asset}`);
  const target = join(uploadsDir, storageKey);
  await mkdir(uploadsDir, { recursive: true });
  await copyFile(join(assetsDir, asset), target);
  return {
    storageKey,
    mimeType,
    originalName: DEMO_ASSET_NAMES[asset] ?? asset,
    byteSize: (await stat(target)).size,
  };
}

async function demoProfileIds(db: DbOrTx): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        eq(profiles.isDemo, true),
        inArray(
          profiles.handle,
          DEMO_ACCOUNTS.map((account) => account.handle),
        ),
      ),
    );
  return new Map(rows.map((row) => [row.handle, row.id]));
}

async function setBanners(
  db: DbOrTx,
  ids: Map<string, string>,
  assetsDir: string,
): Promise<number> {
  let updated = 0;
  for (const [handle, id] of ids) {
    const image = await readFile(join(assetsDir, `banner-${handle}.jpg`));
    const rows = await db
      .update(profiles)
      .set({ bannerUrl: `data:image/jpeg;base64,${image.toString("base64")}` })
      .where(and(eq(profiles.id, id), isNull(profiles.bannerUrl)))
      .returning({ id: profiles.id });
    updated += rows.length;
  }
  return updated;
}

async function createPosts(
  db: DbOrTx,
  ids: Map<string, string>,
  files: { uploadsDir: string; assetsDir: string } | null,
): Promise<number> {
  const wanted = DEMO_MEDIA_POSTS.filter((post) => files || !post.image);
  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      inArray(
        posts.id,
        wanted.map((post) => demoUuid(`post:${post.key}`)),
      ),
    );
  const existingIds = new Set(existing.map((row) => row.id));

  let created = 0;
  for (const post of wanted) {
    const id = demoUuid(`post:${post.key}`);
    if (existingIds.has(id)) continue;
    const authorId = ids.get(post.authorHandle)!;
    await db.insert(posts).values({
      id,
      authorId,
      format: post.format ?? null,
      body: post.body,
      createdAt: hoursAgo(post.hoursAgo),
    });
    if (post.image && files) {
      const stored = await storeAsset(
        files.uploadsDir,
        files.assetsDir,
        post.image,
        `post:${post.key}`,
      );
      await db.insert(postAttachments).values({ postId: id, authorId, ...stored });
    }
    created += 1;
  }
  return created;
}

async function addImagesToExistingPosts(
  db: DbOrTx,
  ids: Map<string, string>,
  files: { uploadsDir: string; assetsDir: string },
): Promise<number> {
  let added = 0;
  for (const target of DEMO_EXISTING_POST_IMAGES) {
    const authorId = ids.get(target.authorHandle)!;
    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.authorId, authorId),
          like(posts.body, `${target.bodyStart}%`),
          isNull(posts.sharedPostId),
          isNull(posts.deletedAt),
        ),
      )
      .orderBy(posts.createdAt)
      .limit(1);
    if (!post) continue;
    const [{ total }] = (await db
      .select({ total: count() })
      .from(postAttachments)
      .where(eq(postAttachments.postId, post.id))) as [{ total: number }];
    if (total > 0) continue;
    const stored = await storeAsset(
      files.uploadsDir,
      files.assetsDir,
      target.image,
      `post:${post.id}`,
    );
    await db.insert(postAttachments).values({ postId: post.id, authorId, ...stored });
    added += 1;
  }
  return added;
}

async function fillWorkMedia(
  db: DbOrTx,
  files: { uploadsDir: string; assetsDir: string },
): Promise<number> {
  let filled = 0;
  for (const plan of DEMO_WORK_MEDIA) {
    const [work] = await db
      .select({ id: works.id, publisherId: works.publisherId })
      .from(works)
      .where(and(eq(works.slug, plan.slug), eq(works.isDemo, true), isNull(works.deletedAt)));
    if (!work) continue;
    const [{ total }] = (await db
      .select({ total: count() })
      .from(workMedia)
      .where(eq(workMedia.workId, work.id))) as [{ total: number }];
    if (total > 0) continue;

    const entries = [
      { asset: plan.cover, kind: "image" as const, role: "cover" as const },
      ...plan.gallery.map((asset) => ({ asset, kind: "image" as const, role: "gallery" as const })),
      ...(plan.video
        ? [{ asset: plan.video, kind: "video" as const, role: "video" as const }]
        : []),
    ];
    for (const [position, entry] of entries.entries()) {
      const stored = await storeAsset(
        files.uploadsDir,
        files.assetsDir,
        entry.asset,
        `work:${plan.slug}:${position}`,
      );
      await db.insert(workMedia).values({
        workId: work.id,
        authorId: work.publisherId,
        kind: entry.kind,
        role: entry.role,
        position,
        ...stored,
      });
    }
    filled += 1;
  }
  return filled;
}

async function fillerProfileIds(db: DbOrTx): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.isDemo, true), eq(profiles.isFiller, true)))
    .orderBy(profiles.handle);
  return rows.map((row) => row.id);
}

// Les utilisations comptées sont des invocations terminées qui citent le skill
// (countSkillUses côté serveur). Celles ajoutées ici n'ont pas de message de
// réponse : rien ne s'affiche dans un salon, seul le compteur bouge. Elles
// pointent vers la question d'un échange de démonstration déjà en place.
async function topUpSkillUses(db: DbOrTx, fillers: string[]): Promise<number> {
  const [anchor] = await db
    .select({
      channelId: assistantInvocations.channelId,
      triggerMessageId: assistantInvocations.triggerMessageId,
    })
    .from(assistantInvocations)
    // Seulement une question posée par un compte de démonstration : le
    // serveur pose aussi `recorded` sur une réponse rejouée à un vrai compte.
    .innerJoin(profiles, eq(profiles.id, assistantInvocations.requestedBy))
    // Une invocation de salon : celles sous un post n'ont ni salon ni message.
    .where(
      and(
        eq(assistantInvocations.recorded, true),
        eq(profiles.isDemo, true),
        isNotNull(assistantInvocations.channelId),
      ),
    )
    .orderBy(assistantInvocations.createdAt)
    .limit(1);
  if (!anchor || fillers.length === 0) return 0;

  let added = 0;
  for (const target of DEMO_SKILL_TARGETS) {
    const [skill] = await db
      .select({ id: skills.id })
      .from(skills)
      .where(and(eq(skills.slug, target.slug), eq(skills.isDemo, true)));
    if (!skill) continue;
    const [{ total }] = (await db
      .select({ total: count() })
      .from(assistantInvocations)
      .where(
        and(
          sql`${assistantInvocations.skillIds} @> array[${skill.id}]::uuid[]`,
          eq(assistantInvocations.status, "done"),
        ),
      )) as [{ total: number }];
    const missing = target.uses - total;
    if (missing < 0) {
      await removeFillerSkillUses(db, skill.id, -missing);
      continue;
    }
    if (missing === 0) continue;

    const rows = Array.from({ length: missing }, (_, index) => {
      // Étalées sur six mois, jamais aujourd'hui : le quota du jour d'un profil n'en voit aucune.
      const createdAt = new Date(daysAgo(1 + (index % 180)).getTime() - (index % 23) * 3_600_000);
      return {
        channelId: anchor.channelId,
        triggerMessageId: anchor.triggerMessageId,
        requestedBy: fillers[(index * 7 + target.slug.length) % fillers.length]!,
        skillIds: [skill.id],
        status: "done" as const,
        createdAt,
        completedAt: createdAt,
      };
    });
    for (const batch of chunk(rows, INSERT_BATCH))
      await db.insert(assistantInvocations).values(batch);
    added += missing;
  }
  return added;
}

// Seulement des utilisations ajoutées par le seed : posées par un figurant,
// sans réponse publiée. Une vraie utilisation n'est jamais retirée.
async function removeFillerSkillUses(db: DbOrTx, skillId: string, excess: number): Promise<void> {
  const rows = await db
    .select({ id: assistantInvocations.id })
    .from(assistantInvocations)
    .innerJoin(profiles, eq(profiles.id, assistantInvocations.requestedBy))
    .where(
      and(
        sql`${assistantInvocations.skillIds} @> array[${skillId}]::uuid[]`,
        eq(profiles.isFiller, true),
        isNull(assistantInvocations.responseMessageId),
        isNull(assistantInvocations.responseReplyId),
      ),
    )
    .limit(excess);
  for (const batch of chunk(rows, INSERT_BATCH))
    await db.delete(assistantInvocations).where(
      inArray(
        assistantInvocations.id,
        batch.map((row) => row.id),
      ),
    );
}

/** Notes de 3 à 5 étoiles dont la moyenne tombe sur `average`. */
export function starsForAverage(total: number, average: number): number[] {
  if (average < 4) {
    // Sous 4 : autant de 5 que d'un quart des notes, compensés par des 3.
    const fives = Math.round(total * 0.25);
    const threes = Math.min(total - fives, fives + Math.round(4 * total - average * total));
    return [
      ...Array<number>(fives).fill(5),
      ...Array<number>(total - fives - threes).fill(4),
      ...Array<number>(threes).fill(3),
    ];
  }
  const threes = Math.round(total * 0.03);
  const rest = total - threes;
  const fives = Math.min(rest, Math.max(0, Math.round(average * total - 3 * threes - 4 * rest)));
  return [
    ...Array<number>(fives).fill(5),
    ...Array<number>(rest - fives).fill(4),
    ...Array<number>(threes).fill(3),
  ];
}

async function topUpSkillRatings(db: DbOrTx, fillers: string[]): Promise<number> {
  let added = 0;
  for (const target of DEMO_SKILL_TARGETS) {
    const [skill] = await db
      .select({ id: skills.id })
      .from(skills)
      .where(and(eq(skills.slug, target.slug), eq(skills.isDemo, true)));
    if (!skill) continue;
    let existing = await db
      .select({ raterId: skillRatings.raterId, stars: skillRatings.stars })
      .from(skillRatings)
      .where(eq(skillRatings.skillId, skill.id));
    const average =
      existing.reduce((sum, row) => sum + row.stars, 0) / Math.max(1, existing.length);
    const onTarget =
      existing.length === target.ratings && Math.abs(average - target.averageStars) < 0.05;
    if (onTarget) continue;
    if (existing.length >= target.ratings) {
      // Cible changée : les notes des figurants sont reposées, celles des comptes gardées.
      const fillerRaters = db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.isFiller, true));
      await db
        .delete(skillRatings)
        .where(
          and(eq(skillRatings.skillId, skill.id), inArray(skillRatings.raterId, fillerRaters)),
        );
      existing = await db
        .select({ raterId: skillRatings.raterId, stars: skillRatings.stars })
        .from(skillRatings)
        .where(eq(skillRatings.skillId, skill.id));
    }
    const missing = target.ratings - existing.length;
    if (missing <= 0) continue;

    const alreadyRated = new Set(existing.map((row) => row.raterId));
    const raters = seededShuffle(fillers, `skill-ratings-${target.slug}`)
      .filter((id) => !alreadyRated.has(id))
      .slice(0, missing);
    const stars = seededShuffle(
      starsForAverage(raters.length, target.averageStars),
      `skill-stars-${target.slug}`,
    );
    const rows = raters.map((raterId, index) => ({
      skillId: skill.id,
      raterId,
      stars: stars[index]!,
      createdAt: daysAgo(1 + (index % 150)),
    }));
    for (const batch of chunk(rows, INSERT_BATCH)) await db.insert(skillRatings).values(batch);
    added += rows.length;
  }
  return added;
}

/**
 * Ajoute images, vidéos, bannières et chiffres d'usage au jeu de démonstration,
 * sur une base déjà remplie par seedDemoDataset. Relançable : chaque étape
 * vérifie ce qui existe et ne complète que ce qui manque. Ne touche qu'aux
 * comptes, posts, travaux et skills de démonstration. Sans `uploadsDir`, les
 * étapes qui écrivent un fichier sont sautées et reprises au passage suivant.
 */
export async function seedDemoMedia(
  db: DbOrTx,
  options: { uploadsDir: string | undefined; assetsDir?: string },
): Promise<DemoMediaResult> {
  const assetsDir = options.assetsDir ?? DEMO_ASSETS_DIR;
  return db.transaction(async (tx) => {
    const ids = await demoProfileIds(tx);
    if (ids.size !== DEMO_ACCOUNTS.length) {
      return { status: "skipped", reason: "comptes de démonstration absents ou incomplets" };
    }
    const files = options.uploadsDir ? { uploadsDir: options.uploadsDir, assetsDir } : null;
    const fillers = await fillerProfileIds(tx);

    return {
      status: "done",
      banners: await setBanners(tx, ids, assetsDir),
      posts: await createPosts(tx, ids, files),
      postImages: files ? await addImagesToExistingPosts(tx, ids, files) : 0,
      works: files ? await fillWorkMedia(tx, files) : 0,
      skillUses: await topUpSkillUses(tx, fillers),
      skillRatings: await topUpSkillRatings(tx, fillers),
      filesWritten: files !== null,
    };
  });
}
