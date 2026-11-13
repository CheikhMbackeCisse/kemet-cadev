import { useSyncExternalStore } from "react";

// Le navigateur ne cherche une nouvelle version qu'au chargement d'une page :
// une app ouverte des jours sans rechargement ne la verrait jamais.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Au-delà, on recharge quand même : le serveur sert déjà la nouvelle page.
const ACTIVATION_TIMEOUT_MS = 8000;
const SKIP_WAITING_TIMEOUT_MS = 3000;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function setWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker;
  for (const listener of listeners) listener();
}

function watchInstallation(worker: ServiceWorker, hasController: () => boolean) {
  if (worker.state === "installed" && hasController()) {
    setWaitingWorker(worker);
    return;
  }
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && hasController()) setWaitingWorker(worker);
  });
}

/**
 * Un service worker qui s'installe alors qu'un autre contrôle déjà la page
 * est une nouvelle version. Au tout premier passage, il n'y a rien à proposer.
 */
export function trackWaitingWorker(registration: ServiceWorkerRegistration, hasController: () => boolean) {
  if (registration.waiting && hasController()) setWaitingWorker(registration.waiting);
  // Une installation commencée avant cet appel : son "updatefound" est déjà passé.
  else if (registration.installing) watchInstallation(registration.installing, hasController);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (installing) watchInstallation(installing, hasController);
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

/**
 * Nouvelle version prête, ou ancien service worker écarté : dans les deux
 * cas, la page chargée ensuite vient de la nouvelle version.
 */
function prepareNewVersion(lookForUpdate: boolean): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.unregister())
        .catch(() => undefined)
        .finally(resolve);
    }, ACTIVATION_TIMEOUT_MS);
    void activateNewVersion(lookForUpdate)
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timer);
        resolve();
      });
  });
}

function installed(worker: ServiceWorker): Promise<ServiceWorker | null> {
  if (worker.state === "installed" || worker.state === "activated") return Promise.resolve(worker);
  return new Promise((resolve) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" || worker.state === "activated") resolve(worker);
      if (worker.state === "redundant") resolve(null);
    });
  });
}

/**
 * Donne la main à la nouvelle version : sans cela, l'ancien service worker
 * resservirait l'ancienne page, dont les morceaux de code n'existent plus.
 */
async function activateNewVersion(lookForUpdate: boolean): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  const registration = await container.getRegistration();
  if (!registration || !container.controller) return;
  if (lookForUpdate && !registration.waiting && !registration.installing) {
    await registration.update().catch(() => undefined);
  }
  const candidate = registration.waiting ?? registration.installing;
  const worker = candidate ? await installed(candidate) : null;
  if (!worker || worker.state === "activated") return;
  const controllerChanged = new Promise<boolean>((resolve) => {
    container.addEventListener("controllerchange", () => resolve(true), { once: true });
    window.setTimeout(() => resolve(false), SKIP_WAITING_TIMEOUT_MS);
  });
  worker.postMessage({ type: "SKIP_WAITING" });
  // L'ancien service worker ne cède parfois pas la main : il resservirait
  // l'ancienne page, ou laisserait le rechargement en suspens. Désinscrit, il
  // ne répond plus aux navigations et la page vient du serveur.
  if (!(await controllerChanged)) await registration.unregister();
}

/** Une nouvelle version attend : le prochain changement de page la charge en entier. */
export function hasWaitingUpdate(): boolean {
  return waitingWorker !== null;
}

/** Changement de page qui recharge le document sur la nouvelle version. */
export function loadWithNewVersion(href: string, replace: boolean) {
  void prepareNewVersion(false).then(() => {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
  });
}

/** Seul geste qui recharge la page en cours : un clic sur "Mettre à jour". */
export function applyUpdate() {
  loadWithNewVersion(window.location.href, true);
}

const RELOAD_GUARD_KEY = "kemet.versionReload";
const RELOAD_GUARD_MS = 60 * 1000;

function readGuard(): number | null {
  try {
    const value = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

function writeGuard(): boolean {
  try {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/**
 * Code d'une page introuvable, le plus souvent parce qu'une nouvelle version
 * a remplacé l'ancienne sur le serveur : un seul rechargement automatique sur
 * la nouvelle version. Un second échec dans la minute laisse passer l'erreur
 * jusqu'à l'écran qui propose de recharger, sans boucle.
 */
export function recoverFromMissingCode(error: unknown): Promise<never> {
  if (import.meta.env.DEV) return Promise.reject(error);
  const lastAttempt = readGuard();
  if (lastAttempt !== null && Date.now() - lastAttempt < RELOAD_GUARD_MS) return Promise.reject(error);
  if (!writeGuard()) return Promise.reject(error);
  void prepareNewVersion(true).then(() => window.location.reload());
  return new Promise<never>(() => {});
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
