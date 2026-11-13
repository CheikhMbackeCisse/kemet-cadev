import { useEffect } from "react";
import { whenIdle } from "../idle.js";
import { preloadPage } from "./pages.js";

const IDLE_TIMEOUT_MS = 2000;

/**
 * Précharge le code des écrans qui suivent pendant qu'on lit celui-ci : le
 * passage à l'étape suivante n'attend plus le réseau. Aussi sur connexion
 * lente, où l'attente se verrait le plus : ce sont quelques kilo-octets,
 * téléchargés pendant la lecture.
 */
export function usePreloadNext(...paths: string[]) {
  const key = paths.join("|");
  useEffect(() => whenIdle(() => key.split("|").forEach(preloadPage), IDLE_TIMEOUT_MS), [key]);
}
