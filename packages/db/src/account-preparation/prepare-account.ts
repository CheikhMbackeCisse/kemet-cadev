import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { and, eq, ilike, ne, or, sql } from "drizzle-orm";
import { LEVEL_THRESHOLDS, levelForPoints, type Level } from "@kemet/shared";
import type { Db, DbOrTx } from "../client.js";
import { computeProfilePoints } from "../points-total.js";
import {
  account,
  channels,
  pointsLedger,
  posts,
  profiles,
  skills,
  user,
  WORK_DISCUSSIONS_SPACE_ID,
  workLinks,
  workMedia,
  works,
} from "../schema/index.js";
import { demoUuid } from "../seed/demo-uuid.js";
import { readBoundedFile, type AccountPlan, type PlannedSkill, type PlannedWork } from "./plan.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Total visé : Scribe, à 40 % du chemin vers Architecte. */
export const TARGET_LEVEL: Level = "scribe";
export const TARGET_SHARE_OF_NEXT_LEVEL = 0.4;

/** Points à `share` du chemin entre le seuil de `level` et celui du niveau suivant. */
export function pointsAtShareOfLevel(level: Level, share: number): number {
  const index = LEVEL_THRESHOLDS.findIndex((threshold) => threshold.level === level);
  const current = LEVEL_THRESHOLDS[index];
  const next = LEVEL_THRESHOLDS[index + 1];
  if (!current || !next) throw new Error(`Aucun niveau après ${level}.`);
  return Math.round(current.minPoints + share * (next.minPoints - current.minPoints));
}

export class PreparationRefusedError extends Error {}

export interface PreparationReport {
  outcome: "not_found" | "dry_run" | "done";
  providers: string[];
  emailVerified: boolean;
  previousHandle: string | null;
  previousDisplayName: string | null;
  /** Autres profils dont le nom ou l'identifiant contient le motif du fichier, jamais modifiés. */
  similarProfiles: { handle: string; displayName: string; isDemo: boolean }[];
  worksCreated: string[];
  worksSkipped: string[];
  skillsCreated: string[];
  skillsSkipped: string[];
  /** Octets des images ajoutées, hors quota de stockage du compte. */
  imageBytes: number;
  targetPoints: number;
  demonstrationPoints: number;
  totalPoints: number | null;
  level: Level | null;
}

function imageMimeType(data: Buffer): string | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.subarray(0, 4).toString("latin1") === "RIFF" &&
    data.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

interface WorkImage {
  path: string;
  role: "cover" | "gallery";
  data: Buffer;
  mimeType: string;
}

async function loadWorkImages(baseDir: string, work: PlannedWork): Promise<WorkImage[]> {
  const entries = [
    { path: work.coverPath, role: "cover" as const },
    ...work.galleryPaths.map((path) => ({ path, role: "gallery" as const })),
  ];
  const images: WorkImage[] = [];
  for (const entry of entries) {
    const data = await readBoundedFile(baseDir, entry.path, MAX_IMAGE_BYTES);
    const mimeType = imageMimeType(data);
    if (!mimeType)
      throw new PreparationRefusedError(`Image PNG, JPEG ou WebP attendue : ${entry.path}`);
    images.push({ ...entry, data, mimeType });
  }
  return images;
}

async function findTargetProfile(db: DbOrTx, email: string) {
  const [owner] = await db
    .select({ id: user.id, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(sql`lower(${user.email})`, email));
  if (!owner) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, owner.id));
  const providers = await db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, owner.id));
  return {
    owner,
    profile: profile ?? null,
    providers: providers.map((row) => row.providerId).sort(),
  };
}

async function findSimilarProfiles(db: DbOrTx, profileId: string, pattern: string | null) {
  if (!pattern) return [];
  const like = `%${pattern.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return db
    .select({ handle: profiles.handle, displayName: profiles.displayName, isDemo: profiles.isDemo })
    .from(profiles)
    .where(
      and(
        ne(profiles.id, profileId),
        or(ilike(profiles.displayName, like), ilike(profiles.handle, like)),
      ),
    )
    .orderBy(profiles.handle);
}

async function workOwner(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({ ownerId: works.publisherId })
    .from(works)
    .where(eq(works.slug, slug));
  return row?.ownerId ?? null;
}

async function skillOwner(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({ ownerId: skills.authorId })
    .from(skills)
    .where(eq(skills.slug, slug));
  return row?.ownerId ?? null;
}

async function insertWork(
  tx: DbOrTx,
  profileId: string,
  work: PlannedWork,
  images: WorkImage[],
  storageKeys: string[],
  createdAt: Date,
) {
  const [created] = await tx
    .insert(works)
    .values({
      publisherId: profileId,
      slug: work.slug,
      title: work.title,
      type: work.type,
      status: work.status,
      summary: work.summary,
      tags: work.tags,
      stack: work.stack,
      year: work.year,
      institution: null,
      publishRightConfirmed: true,
      createdAt,
      updatedAt: createdAt,
    })
    .returning({ id: works.id });
  const workId = created!.id;
  // Même publication que POST /api/works : un salon de discussion, puis
  // l'annonce sans texte dans le fil.
  const [channel] = await tx
    .insert(channels)
    .values({
      spaceId: WORK_DISCUSSIONS_SPACE_ID,
      name: work.title,
      slug: work.slug,
      displayOrder: 0,
      createdAt,
    })
    .returning({ id: channels.id });
  await tx.update(works).set({ channelId: channel!.id }).where(eq(works.id, workId));
  if (work.links.length > 0) {
    await tx.insert(workLinks).values(
      work.links.map((link, position) => ({
        workId,
        type: link.type,
        url: link.url,
        label: link.label ?? null,
        position,
      })),
    );
  }
  for (const [position, image] of images.entries()) {
    await tx.insert(workMedia).values({
      workId,
      authorId: profileId,
      kind: "image",
      role: image.role,
      position,
      storageKey: storageKeys[position]!,
      mimeType: image.mimeType,
      originalName: basename(image.path),
      byteSize: image.data.byteLength,
      createdAt,
    });
  }
  await tx.insert(posts).values({ authorId: profileId, body: "", workId, createdAt });
}

const isDemonstrationRow = (profileId: string) =>
  and(eq(pointsLedger.profileId, profileId), eq(pointsLedger.source, "demonstration"));

/** Montant que doit porter la ligne "demonstration" pour que le total atteigne `target`. */
async function demonstrationPointsNeeded(db: DbOrTx, profileId: string, target: number) {
  const [existing] = await db
    .select({ amount: pointsLedger.amount })
    .from(pointsLedger)
    .where(isDemonstrationRow(profileId));
  const { totalPoints } = await computeProfilePoints(db, profileId);
  return Math.max(0, target - (totalPoints - (existing?.amount ?? 0)));
}

// Une seule ligne "demonstration" par profil (source_id = le profil) :
// relancer le script ajuste son montant au lieu d'en ajouter une autre.
async function settleDemonstrationPoints(tx: DbOrTx, profileId: string, target: number) {
  const needed = await demonstrationPointsNeeded(tx, profileId, target);
  if (needed === 0) {
    await tx.delete(pointsLedger).where(isDemonstrationRow(profileId));
    return 0;
  }
  await tx
    .insert(pointsLedger)
    .values({ profileId, source: "demonstration", sourceId: profileId, amount: needed })
    .onConflictDoUpdate({
      target: [pointsLedger.source, pointsLedger.sourceId, pointsLedger.profileId],
      set: { amount: needed },
    });
  return needed;
}

/**
 * Prépare un compte réel existant pour la démonstration : profil, travaux,
 * skills et points. Toutes les vérifications passent avant la moindre
 * écriture ; rien n'est fait si le compte n'existe pas.
 */
export async function prepareAccount(
  db: Db,
  plan: AccountPlan,
  options: { uploadsDir: string; dryRun: boolean },
): Promise<PreparationReport> {
  const targetPoints = pointsAtShareOfLevel(TARGET_LEVEL, TARGET_SHARE_OF_NEXT_LEVEL);
  const report: PreparationReport = {
    outcome: "not_found",
    providers: [],
    emailVerified: false,
    previousHandle: null,
    previousDisplayName: null,
    similarProfiles: [],
    worksCreated: [],
    worksSkipped: [],
    skillsCreated: [],
    skillsSkipped: [],
    imageBytes: 0,
    targetPoints,
    demonstrationPoints: 0,
    totalPoints: null,
    level: null,
  };

  const target = await findTargetProfile(db, plan.email);
  if (!target) return report;
  report.providers = target.providers;
  report.emailVerified = target.owner.emailVerified;
  const { profile } = target;
  if (!profile)
    throw new PreparationRefusedError("Le compte existe mais n'a pas encore de profil.");
  if (profile.kind !== "person" || profile.isDemo || profile.isFiller) {
    throw new PreparationRefusedError("Ce profil n'est pas celui d'une personne réelle.");
  }
  if (profile.deletedAt || profile.suspendedAt) {
    throw new PreparationRefusedError("Ce compte est supprimé ou suspendu.");
  }
  // Un compte à l'adresse jamais vérifiée peut avoir été créé par quelqu'un
  // d'autre que la personne visée : rien ne lui est donné.
  if (!target.owner.emailVerified) {
    throw new PreparationRefusedError("L'adresse de ce compte n'a jamais été vérifiée.");
  }
  report.previousHandle = profile.handle;
  report.previousDisplayName = profile.displayName;
  report.similarProfiles = await findSimilarProfiles(db, profile.id, plan.similarNamePattern);

  const [handleTaken] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.handle, plan.profile.handle), ne(profiles.id, profile.id)));
  if (handleTaken) {
    throw new PreparationRefusedError(
      `L'identifiant ${plan.profile.handle} est déjà porté par un autre profil.`,
    );
  }

  const worksToCreate: PlannedWork[] = [];
  for (const work of plan.works) {
    const owner = await workOwner(db, work.slug);
    if (owner && owner !== profile.id) {
      throw new PreparationRefusedError(`Le travail ${work.slug} appartient à un autre profil.`);
    }
    if (owner) report.worksSkipped.push(work.slug);
    else worksToCreate.push(work);
  }
  const skillsToCreate: PlannedSkill[] = [];
  for (const skill of plan.skills) {
    const owner = await skillOwner(db, skill.slug);
    if (owner && owner !== profile.id) {
      throw new PreparationRefusedError(`Le skill ${skill.slug} appartient à un autre profil.`);
    }
    if (owner) report.skillsSkipped.push(skill.slug);
    else skillsToCreate.push(skill);
  }
  const imagesByWork = new Map<string, WorkImage[]>();
  for (const work of worksToCreate)
    imagesByWork.set(work.slug, await loadWorkImages(plan.baseDir, work));
  report.imageBytes = [...imagesByWork.values()]
    .flat()
    .reduce((total, image) => total + image.data.byteLength, 0);

  if (options.dryRun) {
    const { totalPoints, level } = await computeProfilePoints(db, profile.id);
    report.outcome = "dry_run";
    report.demonstrationPoints = await demonstrationPointsNeeded(db, profile.id, targetPoints);
    report.worksCreated = worksToCreate.map((work) => work.slug);
    report.skillsCreated = skillsToCreate.map((skill) => skill.slug);
    report.totalPoints = totalPoints;
    report.level = level;
    return report;
  }

  // Clés dérivées du profil et du travail : relancer réécrit les mêmes fichiers.
  const storageKeysByWork = new Map<string, string[]>();
  await mkdir(options.uploadsDir, { recursive: true });
  for (const work of worksToCreate) {
    const keys: string[] = [];
    for (const [position, image] of imagesByWork.get(work.slug)!.entries()) {
      const key = demoUuid(`prepared-account:${profile.id}:work:${work.slug}:${position}`);
      await writeFile(join(options.uploadsDir, key), image.data);
      keys.push(key);
    }
    storageKeysByWork.set(work.slug, keys);
  }

  const writtenKeys = [...storageKeysByWork.values()].flat();
  await db
    .transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({
          displayName: plan.profile.displayName,
          handle: plan.profile.handle,
          role: plan.profile.role,
          organization: plan.profile.organization,
          country: plan.profile.country,
          onboardingCompletedAt: profile.onboardingCompletedAt ?? new Date(),
        })
        .where(eq(profiles.id, profile.id));

      // Le premier travail du fichier est le plus récent, donc le premier affiché.
      const now = Date.now();
      for (const [index, work] of worksToCreate.entries()) {
        const createdAt = new Date(now - index * 60_000);
        await insertWork(
          tx,
          profile.id,
          work,
          imagesByWork.get(work.slug)!,
          storageKeysByWork.get(work.slug)!,
          createdAt,
        );
      }
      for (const skill of skillsToCreate) {
        await tx.insert(skills).values({
          authorId: profile.id,
          slug: skill.slug,
          name: skill.name,
          description: skill.description,
          content: skill.content,
          tags: skill.tags,
          visibility: "public",
        });
      }
      report.demonstrationPoints = await settleDemonstrationPoints(tx, profile.id, targetPoints);
    })
    .catch(async (error: unknown) => {
      // Aucune ligne ne cite ces fichiers : le nettoyage horaire, qui part de la
      // base, ne les retrouverait jamais.
      await Promise.all(
        writtenKeys.map((key) => rm(join(options.uploadsDir, key), { force: true })),
      );
      throw error;
    });

  const { totalPoints } = await computeProfilePoints(db, profile.id);
  report.outcome = "done";
  report.worksCreated = worksToCreate.map((work) => work.slug);
  report.skillsCreated = skillsToCreate.map((skill) => skill.slug);
  report.totalPoints = totalPoints;
  report.level = levelForPoints(totalPoints);
  return report;
}
