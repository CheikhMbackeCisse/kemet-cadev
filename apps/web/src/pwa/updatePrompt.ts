import { useSyncExternalStore } from "react";

// Le navigateur ne cherche une nouvelle version qu'au chargement d'une page :
// une app ouverte des jours sans rechargement ne la verrait jamais.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function setWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker;
  for (const listener of listeners) listener();
}

/**
 * Un service worker qui s'installe alors qu'un autre contrôle déjà la page
 * est une nouvelle version. Au tout premier passage, il n'y a rien à proposer.
 */
export function trackWaitingWorker(registration: ServiceWorkerRegistration, hasController: () => boolean) {
  if (registration.waiting && hasController()) setWaitingWorker(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && hasController()) setWaitingWorker(installing);
    });
  });
}

export function watchForUpdate() {
  if (!("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  void container.ready.then((registration) => {
    trackWaitingWorker(registration, () => container.controller !== null);
    let lastCheck = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheck = Date.now();
      void registration.update();
    });
  });
}

/** Seul chemin qui recharge la page : un clic sur "Mettre à jour". */
export function applyUpdate() {
  const worker = waitingWorker;
  if (!worker) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => waitingWorker !== null,
    () => false,
  );
}

export function resetUpdatePromptForTests() {
  waitingWorker = null;
  listeners.clear();
}

export function hasWaitingWorkerForTests() {
  return waitingWorker !== null;
}
