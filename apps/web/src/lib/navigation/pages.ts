import type { ComponentType } from "react";
import { INTRO_BASE_PATH } from "../intro/introSteps.js";
import { ONBOARDING_BASE_PATH } from "../onboarding/steps.js";

type PageModule = Promise<{ default: ComponentType }>;

const loadedPages = new WeakSet<() => PageModule>();

function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  const loader = (): PageModule =>
    load().then((module) => {
      loadedPages.add(loader);
      return { default: module[name] };
    });
  return loader;
}

// Chaque page est chargée à la demande : un seul fichier pour tous les écrans
// pesait 610 ko avant le premier affichage. Les chargeurs vivent ici, à part
// des composants, pour précharger une page avant de l'afficher.
export const PAGE_LOADERS = {
  notFound: page(() => import("../../pages/NotFoundPage.js"), "NotFoundPage"),
  newSpace: page(() => import("../../pages/NewSpacePage.js"), "NewSpacePage"),
  space: page(() => import("../../pages/SpacePage.js"), "SpacePage"),
  messages: page(() => import("../../pages/MessagesPage.js"), "MessagesPage"),
  newConversation: page(() => import("../../pages/NewConversationPage.js"), "NewConversationPage"),
  invite: page(() => import("../../pages/InvitePage.js"), "InvitePage"),
  newSkill: page(() => import("../../pages/NewSkillPage.js"), "NewSkillPage"),
  skills: page(() => import("../../pages/SkillsPage.js"), "SkillsPage"),
  skill: page(() => import("../../pages/SkillPage.js"), "SkillPage"),
  newPost: page(() => import("../../pages/NewPostPage.js"), "NewPostPage"),
  feed: page(() => import("../../pages/FeedPage.js"), "FeedPage"),
  post: page(() => import("../../pages/PostPage.js"), "PostPage"),
  newProject: page(() => import("../../pages/NewProjectPage.js"), "NewProjectPage"),
  projects: page(() => import("../../pages/ProjectsPage.js"), "ProjectsPage"),
  newHelpRequest: page(() => import("../../pages/NewHelpRequestPage.js"), "NewHelpRequestPage"),
  project: page(() => import("../../pages/ProjectPage.js"), "ProjectPage"),
  newCompetition: page(() => import("../../pages/NewCompetitionPage.js"), "NewCompetitionPage"),
  competitions: page(() => import("../../pages/CompetitionsPage.js"), "CompetitionsPage"),
  submitProject: page(() => import("../../pages/SubmitProjectPage.js"), "SubmitProjectPage"),
  competition: page(() => import("../../pages/CompetitionPage.js"), "CompetitionPage"),
  pro: page(() => import("../../pages/ProPage.js"), "ProPage"),
  moderation: page(() => import("../../pages/ModerationPage.js"), "ModerationPage"),
  login: page(() => import("../../pages/LoginPage.js"), "LoginPage"),
  signup: page(() => import("../../pages/SignupPage.js"), "SignupPage"),
  forgotPassword: page(() => import("../../pages/ForgotPasswordPage.js"), "ForgotPasswordPage"),
  resetPassword: page(() => import("../../pages/ResetPasswordPage.js"), "ResetPasswordPage"),
  completeProfile: page(() => import("../../pages/CompleteProfilePage.js"), "CompleteProfilePage"),
  welcome: page(() => import("../../pages/WelcomePage.js"), "WelcomePage"),
  introQuestions: page(() => import("../../pages/IntroQuestionsPage.js"), "IntroQuestionsPage"),
  onboarding: page(() => import("../../pages/OnboardingPage.js"), "OnboardingPage"),
  settings: page(() => import("../../pages/SettingsPage.js"), "SettingsPage"),
  accountSettings: page(
    () => import("../../pages/settings/AccountSettingsPage.js"),
    "AccountSettingsPage",
  ),
  profileSettings: page(
    () => import("../../pages/settings/ProfileSettingsPage.js"),
    "ProfileSettingsPage",
  ),
  appearanceSettings: page(
    () => import("../../pages/settings/AppearanceSettingsPage.js"),
    "AppearanceSettingsPage",
  ),
  dataSettings: page(() => import("../../pages/settings/DataSettingsPage.js"), "DataSettingsPage"),
  helpSettings: page(() => import("../../pages/settings/HelpSettingsPage.js"), "HelpSettingsPage"),
  moi: page(() => import("../../pages/MoiPage.js"), "MoiPage"),
  levels: page(() => import("../../pages/LevelsPage.js"), "LevelsPage"),
  demoData: page(() => import("../../pages/DemoDataPage.js"), "DemoDataPage"),
  savedPosts: page(() => import("../../pages/SavedPostsPage.js"), "SavedPostsPage"),
  deleteAccount: page(() => import("../../pages/DeleteAccountPage.js"), "DeleteAccountPage"),
  privacy: page(() => import("../../pages/PrivacyPage.js"), "PrivacyPage"),
  works: page(() => import("../../pages/WorksPage.js"), "WorksPage"),
  work: page(() => import("../../pages/WorkPage.js"), "WorkPage"),
  workForm: page(() => import("../../pages/WorkFormPage.js"), "WorkFormPage"),
  workFilters: page(() => import("../../pages/WorkFiltersPage.js"), "WorkFiltersPage"),
  user: page(() => import("../../pages/UserPage.js"), "UserPage"),
} as const;

export type PageKey = keyof typeof PAGE_LOADERS;

/** Pages servies par App elle-même, sans chargeur. */
export type SpecialPage = "root" | "roleRedirect" | "status" | "devUi" | "devShell";

export function pageFor(pathname: string): PageKey | SpecialPage {
  if (pathname === "/") return "root";
  if (pathname === "/connexion") return "login";
  if (pathname === "/inscription") return "signup";
  if (pathname === "/mot-de-passe-oublie") return "forgotPassword";
  if (pathname === "/reinitialiser-mot-de-passe") return "resetPassword";
  if (pathname === "/completer-profil") return "completeProfile";
  if (pathname === INTRO_BASE_PATH || pathname === `${INTRO_BASE_PATH}/`) return "welcome";
  if (pathname.startsWith(`${INTRO_BASE_PATH}/`)) return "introQuestions";
  if (pathname === "/ton-role") return "roleRedirect";
  if (pathname === ONBOARDING_BASE_PATH || pathname.startsWith(`${ONBOARDING_BASE_PATH}/`))
    return "onboarding";
  if (pathname === "/parametres") return "settings";
  if (pathname === "/parametres/supprimer-mon-compte") return "deleteAccount";
  if (pathname === "/parametres/compte") return "accountSettings";
  if (pathname === "/parametres/profil") return "profileSettings";
  if (pathname === "/parametres/apparence") return "appearanceSettings";
  if (pathname === "/parametres/donnees") return "dataSettings";
  if (pathname === "/parametres/aide") return "helpSettings";
  if (pathname === "/moi") return "moi";
  if (pathname === "/niveaux" || pathname === "/niveaux/") return "levels";
  if (pathname === "/enregistres") return "savedPosts";
  if (pathname === "/donnees-de-demo") return "demoData";
  if (pathname === "/confidentialite") return "privacy";
  if (pathname.startsWith("/salons/invite/")) return "invite";
  if (pathname === "/salons/nouveau") return "newSpace";
  if (pathname.startsWith("/salons")) return "space";
  if (pathname === "/messages/nouveau") return "newConversation";
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return "messages";
  if (pathname === "/skills" || pathname === "/skills/") return "skills";
  if (pathname === "/skills/nouveau") return "newSkill";
  if (pathname.startsWith("/skills/")) return "skill";
  if (pathname === "/fil" || pathname === "/fil/") return "feed";
  if (pathname === "/fil/nouveau") return "newPost";
  if (pathname.startsWith("/fil/")) return "post";
  if (pathname === "/projets" || pathname === "/projets/") return "projects";
  if (pathname === "/projets/nouveau") return "newProject";
  if (/^\/projets\/[^/]+\/demandes\/nouvelle$/.test(pathname)) return "newHelpRequest";
  if (pathname.startsWith("/projets/")) return "project";
  if (pathname === "/travaux" || pathname === "/travaux/") return "works";
  if (pathname === "/travaux/nouveau" || /^\/travaux\/[^/]+\/modifier\/?$/.test(pathname))
    return "workForm";
  if (pathname === "/travaux/filtres") return "workFilters";
  if (pathname.startsWith("/travaux/")) return "work";
  if (pathname === "/competitions" || pathname === "/competitions/") return "competitions";
  if (pathname === "/competitions/nouvelle") return "newCompetition";
  if (/^\/competitions\/[^/]+\/soumettre$/.test(pathname)) return "submitProject";
  if (pathname.startsWith("/competitions/")) return "competition";
  if (pathname.startsWith("/u/")) return "user";
  if (pathname === "/pro") return "pro";
  if (pathname === "/moderation") return "moderation";
  // L'état des services et le catalogue de composants n'ont rien à faire
  // devant le public : en production, ces adresses sont introuvables.
  if (import.meta.env.DEV) {
    if (pathname === "/statut") return "status";
    if (pathname.startsWith("/dev/ui/shell")) return "devShell";
    if (pathname.startsWith("/dev/ui")) return "devUi";
  }
  return "notFound";
}

function isPageKey(page: PageKey | SpecialPage): page is PageKey {
  return page in PAGE_LOADERS;
}

/** Code de la page déjà téléchargé : l'afficher ne demande plus rien au réseau. */
export function isPageLoaded(pathname: string): boolean {
  const key = pageFor(pathname);
  const target = key === "root" ? "feed" : key;
  return isPageKey(target) && loadedPages.has(PAGE_LOADERS[target]);
}

const preloaded = new Set<PageKey>();

/** Télécharge le code d'une page sans l'afficher ; sans effet la deuxième fois. */
export function preloadPage(pathOrUrl: string) {
  const pathname = new URL(pathOrUrl, window.location.href).pathname;
  const key = pageFor(pathname);
  const target: PageKey | null = key === "root" ? "feed" : isPageKey(key) ? key : null;
  if (!target || preloaded.has(target)) return;
  preloaded.add(target);
  PAGE_LOADERS[target]().catch(() => preloaded.delete(target));
}

// Les onglets principaux de la barre d'activité et de la barre du bas.
export const MAIN_SECTION_PATHS = ["/fil", "/salons", "/travaux", "/skills", "/messages", "/moi"];
