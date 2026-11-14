import type { ArrivalMotion } from "../../components/arrival/ArrivalBackground.js";
import { hasSeenIntro } from "../intro/introStorage.js";

/**
 * Adresses du parcours d'arrivée. Même liste que public/theme-init.js, qui
 * pose le fond avant le premier affichage (arrival.test.ts les compare).
 */
export const ARRIVAL_PATH_PATTERN =
  /^\/(decouvrir|connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe|completer-profil|bienvenue)(\/|$)/;

const WELCOME_PATH = /^\/decouvrir\/?$/;
const ACCOUNT_PATH =
  /^\/(connexion|inscription|mot-de-passe-oublie|reinitialiser-mot-de-passe)(\/|$)/;

/**
 * Fond à poser sous une adresse : "rich" pour l'accueil (et la racine d'une
 * première visite, qui y mène) et les écrans de compte, "calm" pour le reste
 * du parcours, null hors du parcours.
 */
export function arrivalMotionFor(pathname: string): ArrivalMotion | null {
  if (WELCOME_PATH.test(pathname) || ACCOUNT_PATH.test(pathname)) return "rich";
  if (pathname === "/") return hasSeenIntro() ? null : "rich";
  return ARRIVAL_PATH_PATTERN.test(pathname) ? "calm" : null;
}
