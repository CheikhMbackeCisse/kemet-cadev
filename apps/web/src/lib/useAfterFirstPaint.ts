import { useSyncExternalStore } from "react";
import { whenIdle } from "./idle.js";

let painted = false;
let started = false;
const listeners = new Set<() => void>();

function markPainted() {
  painted = true;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  const afterLoad = () => whenIdle(markPainted, 1500);
  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

/**
 * Vrai une fois la page chargée et le navigateur libre : le décor attend que
 * le logo, le titre et les boutons soient affichés. Le même instant pour
 * tous les appelants (le fond et les bandes se mesurent l'un l'autre), puis
 * toujours vrai.
 */
export function useAfterFirstPaint(): boolean {
  return useSyncExternalStore(subscribe, () => painted);
}
