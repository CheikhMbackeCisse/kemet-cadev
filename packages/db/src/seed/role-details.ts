import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DbOrTx } from "../client.js";
import { profiles } from "../schema/index.js";

type RoleDetail = Pick<
  typeof profiles.$inferInsert,
  "role" | "workMode" | "organization" | "title"
>;

/**
 * Précision du rôle des comptes de démonstration. Écoles et entreprises
 * toutes inventées. Le titre est raccourci là où il répétait l'établissement
 * ou l'entreprise, désormais affichés à côté du rôle.
 */
export const DEMO_ROLE_DETAILS: Record<string, RoleDetail> = {
  "coumba-thiam": { role: "developer", workMode: "employed", organization: "Jàmm Pay" },
  "ebo-quansah": { role: "developer", workMode: "employed", organization: "Sika Mobile Banking" },
  "lyna-bouzid": { role: "developer", workMode: "freelance", organization: null, title: "DevOps" },
  "dapo-oyelaran": { role: "developer", workMode: "employed", organization: "Ìrìn Labs" },
  "kgomotso-mahlangu": { role: "developer", workMode: "employed", organization: "Kasi Market" },
  "skander-jaziri": {
    role: "developer",
    workMode: "freelance",
    organization: null,
    title: "Full-stack",
  },
  "ahou-kouadio": {
    role: "student",
    workMode: null,
    organization: "Institut Lagune du numérique",
    title: "Génie logiciel, jeux vidéo",
  },
  "kiprono-langat": { role: "developer", workMode: "employed", organization: "PesaRails" },
  "ghizlane-amrani": {
    role: "student",
    workMode: null,
    organization: "Institut Atlas du langage",
    title: "Doctorat en traitement du langage",
  },
  "heritier-kabeya": { role: "developer", workMode: "employed", organization: "Shamba Sense" },
  "mariam-diakite": {
    role: "hr",
    workMode: null,
    organization: "Sahel Talents",
    title: "Responsable recrutement",
  },
  "tunde-bakare": {
    role: "hr",
    workMode: null,
    organization: "Lagos Hire Lab",
    title: "Recrutement tech",
  },
  "wanjiru-kamau": {
    role: "hr",
    workMode: null,
    organization: "Savanna Works",
    title: "Chargée de recrutement",
  },
  "aissatou-barry": {
    role: "entrepreneur",
    workMode: null,
    organization: "Kobo Market",
    title: "Fondatrice",
  },
  "yannick-mbarga": {
    role: "student",
    workMode: null,
    organization: "Université des Sept Collines",
    title: "Licence 1 informatique",
  },
  "salma-haddad": {
    role: "student",
    workMode: null,
    organization: "Prépa intégrée du Sahel",
    title: "Première année de prépa",
  },
};

/**
 * Pose la précision sur les profils de démonstration qui n'en ont aucune.
 * Relançable : un profil déjà précisé, ou qui n'est pas de démonstration,
 * n'est jamais touché.
 */
export async function completeDemoRoleDetails(db: DbOrTx): Promise<number> {
  const rows = await db
    .select({ id: profiles.id, handle: profiles.handle })
    .from(profiles)
    .where(
      and(
        inArray(profiles.handle, Object.keys(DEMO_ROLE_DETAILS)),
        eq(profiles.isDemo, true),
        isNull(profiles.workMode),
        isNull(profiles.organization),
      ),
    );
  for (const row of rows) {
    await db.update(profiles).set(DEMO_ROLE_DETAILS[row.handle]!).where(eq(profiles.id, row.id));
  }
  return rows.length;
}
