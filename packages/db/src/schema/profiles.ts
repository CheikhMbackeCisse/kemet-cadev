import { relations } from "drizzle-orm";
import { bigint, boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const profileRoleEnum = pgEnum("profile_role", [
  "developer",
  "designer",
  "hr",
  "student",
  "project_manager",
  "entrepreneur",
  "other",
]);

export const onboardingStepEnum = pgEnum("onboarding_step", [
  "country",
  "role",
  "specialty",
  "interests",
  "spaces",
  "people",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Vide une fois le compte supprimé : le profil reste, anonymisé, pour que
  // ses contenus et ceux qui y répondent restent lisibles (ADR 0023).
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  country: text("country").notNull(),
  // Facultatif, l'étape qui le propose se passe. title porte la spécialité.
  role: profileRoleEnum("role"),
  // Précision libre quand le rôle choisi est "other", posée par l'accueil.
  roleOther: text("role_other"),
  title: text("title"),
  bio: text("bio"),
  stack: text("stack").array().notNull().default([]),
  githubUrl: text("github_url"),
  gitlabUrl: text("gitlab_url"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  websiteUrl: text("website_url"),
  // Badge "Aide les débutants", activé par la personne elle-même : elle passe
  // en tête des personnes proposées à un débutant.
  helpsBeginners: boolean("helps_beginners").notNull().default(false),
  // Jamais accepté du client : seul le seed en pose un.
  avatarUrl: text("avatar_url"),
  // Même règle que avatarUrl : posée par le seed, jamais par le client.
  bannerUrl: text("banner_url"),
  openToOpportunities: boolean("open_to_opportunities").notNull().default(false),
  // Sujets choisis à l'onboarding, valeurs de INTERESTS (@kemet/shared). Ne
  // servent qu'aux suggestions d'espaces et de personnes.
  interests: text("interests").array().notNull().default([]),
  // Précision libre quand le sujet "other" est coché.
  interestOther: text("interest_other"),
  // Ce que la personne vient faire ou cherche, valeurs de INTENTS (@kemet/shared).
  intents: text("intents").array().notNull().default([]),
  // Écran où reprendre l'onboarding. Le parcours est terminé (ou entièrement
  // passé) dès que onboardingCompletedAt est posé : on n'y renvoie plus.
  onboardingStep: onboardingStepEnum("onboarding_step").notNull().default("country"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  isDemo: boolean("is_demo").notNull().default(false),
  // Figurant du seed de démonstration : sans aucun moyen de connexion,
  // compté dans les totaux mais jamais montré (liste, recherche, profil,
  // mention, messagerie). Voir docs/adr/0032-figurants-invisibles.md.
  isFiller: boolean("is_filler").notNull().default(false),
  // Validation des compétitions et modération. Attribué seulement par
  // `pnpm db:promote-admin`, jamais par l'interface ni par le seed.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  // Un compte suspendu garde la lecture, perd l'écriture : vérifié par
  // requireOwnProfile dans chaque module de routes.
  suspendedAt: timestamp("suspended_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const cvVisibilityEnum = pgEnum("cv_visibility", ["public", "members"]);

// Un CV au plus par profil : en envoyer un autre remplace le fichier.
export const profileCvs = pgTable("profile_cvs", {
  profileId: uuid("profile_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  byteSize: bigint("byte_size", { mode: "number" }).notNull(),
  visibility: cvVisibilityEnum("visibility").notNull().default("members"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(user, {
    fields: [profiles.userId],
    references: [user.id],
  }),
}));
