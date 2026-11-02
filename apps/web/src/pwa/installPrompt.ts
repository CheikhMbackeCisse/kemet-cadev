import { useSyncExternalStore } from "react";

const VISITS_KEY = "kemet:visits";
const DISMISSED_KEY = "kemet:install-dismissed";
const SESSION_COUNTED_KEY = "kemet:visit-counted";
export const VISITS_BEFORE_INSTALL_OFFER = 3;

/** Événement non standard de Chrome et Edge, absent des types du DOM. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Une visite par onglet ouvert, pas par page affichée. */
export function countVisit(local: Storage, session: Storage): number {
  const visits = Number(local.getItem(VISITS_KEY)) || 0;
  if (session.getItem(SESSION_COUNTED_KEY)) return visits;
  session.setItem(SESSION_COUNTED_KEY, "1");
  local.setItem(VISITS_KEY, String(visits + 1));
  return visits + 1;
}

export function shouldOfferInstall(local: Storage, visits: number): boolean {
  return visits >= VISITS_BEFORE_INSTALL_OFFER && local.getItem(DISMISSED_KEY) === null;
}

export function dismissInstallOffer(local: Storage) {
  local.setItem(DISMISSED_KEY, "1");
}
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  for (const listener of listeners) listener();
}

/**
 * Posé au démarrage : le navigateur peut émettre l'événement avant que la page
 * qui affiche le bandeau soit chargée.
 */
export function listenForInstallPrompt() {
  const visits = countVisit(window.localStorage, window.sessionStorage);
  if (!shouldOfferInstall(window.localStorage, visits)) return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, () => deferredPrompt);

  // L'offre ne revient plus, quelle que soit la réponse à la fenêtre du
  // navigateur : la redemander après un refus serait insistant.
  async function install() {
    if (!event) return;
    dismissInstallOffer(window.localStorage);
    setDeferredPrompt(null);
    await event.prompt();
  }

  function dismiss() {
    dismissInstallOffer(window.localStorage);
    setDeferredPrompt(null);
  }

  return { canInstall: event !== null, install, dismiss };
}
