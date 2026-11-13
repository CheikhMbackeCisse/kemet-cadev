import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import {
  createSkillSchema,
  createWorkSchema,
  isReservedHandle,
  MAX_WORK_GALLERY_IMAGES,
  updateProfileSchema,
  type CreateSkillInput,
  type WorkLinkInput,
  type WorkStatus,
  type WorkType,
} from "@kemet/shared";

// Le fichier lu est écrit à la main, en français, et n'est jamais versionné :
// il porte l'adresse du compte et des contenus que seule la personne valide.
interface PlanFile {
  email?: unknown;
  profil?: {
    nom?: unknown;
    identifiant?: unknown;
    role?: unknown;
    etablissement?: unknown;
    pays?: unknown;
  };
  travaux?: Array<Record<string, unknown>>;
  skills?: Array<Record<string, unknown>>;
}

export interface PlannedWork {
  slug: string;
  title: string;
  type: WorkType;
  status: WorkStatus;
  summary: string;
  tags: string[];
  stack: string[];
  year: number | null;
  links: WorkLinkInput[];
  /** Chemins absolus des images, couverture d'abord. */
  coverPath: string;
  galleryPaths: string[];
}

export interface PlannedSkill extends CreateSkillInput {
  contentPath: string;
}

export interface AccountPlan {
  email: string;
  profile: {
    displayName: string;
    handle: string;
    role: "student";
    organization: string;
    country: string;
  };
  works: PlannedWork[];
  skills: PlannedSkill[];
}

export class InvalidPlanError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidPlanError(`Champ manquant ou vide : ${field}`);
  }
  return value.trim();
}

// Un chemin du fichier ne doit jamais sortir de son dossier.
function resolveInside(baseDir: string, relativePath: string, field: string): string {
  if (isAbsolute(relativePath)) throw new InvalidPlanError(`Chemin absolu refusé : ${field}`);
  const resolved = normalize(join(baseDir, relativePath));
  if (!resolved.startsWith(normalize(baseDir) + sep)) {
    throw new InvalidPlanError(`Chemin hors du dossier du fichier : ${field}`);
  }
  return resolved;
}

function parseProfile(file: PlanFile) {
  const profile = file.profil ?? {};
  const parsed = updateProfileSchema.parse({
    displayName: requireString(profile.nom, "profil.nom"),
    handle: requireString(profile.identifiant, "profil.identifiant"),
    role: profile.role,
    organization: requireString(profile.etablissement, "profil.etablissement"),
    country: profile.pays,
  });
  if (parsed.role !== "student") {
    throw new InvalidPlanError("Seul le rôle student est prévu par ce script.");
  }
  return {
    displayName: parsed.displayName!,
    handle: parsed.handle!,
    role: "student" as const,
    organization: parsed.organization!,
    country: parsed.country!,
  };
}

function parseWork(entry: Record<string, unknown>, index: number, baseDir: string): PlannedWork {
  const field = `travaux[${index}]`;
  const parsed = createWorkSchema.parse({
    slug: entry.identifiant,
    title: entry.titre,
    type: entry.type,
    status: entry.statut,
    summary: entry.resume,
    tags: entry.tags ?? [],
    stack: entry.stack ?? [],
    year: entry.annee ?? null,
    links: (Array.isArray(entry.liens) ? entry.liens : []).map((link: Record<string, unknown>) => ({
      type: link.type,
      url: link.url,
      label: link.libelle ?? null,
    })),
    publishRightConfirmed: true,
  });
  const gallery = Array.isArray(entry.galerie) ? entry.galerie : [];
  if (gallery.length > MAX_WORK_GALLERY_IMAGES) {
    throw new InvalidPlanError(`${field}.galerie : ${MAX_WORK_GALLERY_IMAGES} images au plus.`);
  }
  return {
    slug: parsed.slug,
    title: parsed.title,
    type: parsed.type,
    status: parsed.status,
    summary: parsed.summary,
    tags: [...new Set(parsed.tags)],
    stack: parsed.stack,
    year: parsed.year ?? null,
    links: parsed.links,
    coverPath: resolveInside(
      baseDir,
      requireString(entry.couverture, `${field}.couverture`),
      `${field}.couverture`,
    ),
    galleryPaths: gallery.map((path, position) =>
      resolveInside(
        baseDir,
        requireString(path, `${field}.galerie[${position}]`),
        `${field}.galerie`,
      ),
    ),
  };
}

async function parseSkill(
  entry: Record<string, unknown>,
  index: number,
  baseDir: string,
): Promise<PlannedSkill> {
  const field = `skills[${index}]`;
  const contentPath = resolveInside(
    baseDir,
    requireString(entry.contenu, `${field}.contenu`),
    `${field}.contenu`,
  );
  const content = await readFile(contentPath, "utf8");
  const parsed = createSkillSchema.parse({
    slug: entry.identifiant,
    name: entry.titre,
    description: entry.resume,
    content,
    tags: entry.tags ?? [],
    visibility: "public",
  });
  return { ...parsed, contentPath };
}

/** Lit et valide le fichier de préparation ; les chemins qu'il cite sont relatifs à son dossier. */
export async function readAccountPlan(planPath: string): Promise<AccountPlan> {
  const baseDir = dirname(planPath);
  const file = JSON.parse(await readFile(planPath, "utf8")) as PlanFile;
  const email = requireString(file.email, "email").toLowerCase();
  const profile = parseProfile(file);
  if (isReservedHandle(profile.handle)) {
    throw new InvalidPlanError(`Identifiant réservé : ${profile.handle}`);
  }
  const works = (file.travaux ?? []).map((entry, index) => parseWork(entry, index, baseDir));
  const skills = await Promise.all(
    (file.skills ?? []).map((entry, index) => parseSkill(entry, index, baseDir)),
  );
  for (const [label, slugs] of [
    ["travaux", works.map((work) => work.slug)],
    ["skills", skills.map((skill) => skill.slug)],
  ] as const) {
    if (new Set(slugs).size !== slugs.length) {
      throw new InvalidPlanError(`Deux ${label} portent le même identifiant.`);
    }
  }
  return { email, profile, works, skills };
}
