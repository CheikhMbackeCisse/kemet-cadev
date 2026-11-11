/**
 * Navigation sans rechargement du document : l'adresse change par l'API
 * History, App rend la page suivante dans une transition React, l'écran
 * précédent reste affiché jusqu'à ce qu'elle soit prête.
 */

import { hasWaitingUpdate, loadWithNewVersion } from "../../pwa/updatePrompt.js";
import { rememberHeights } from "./rememberedHeights.js";

export const NAVIGATE_EVENT = "kemet:navigate";
// Marque les entrées d'historique créées par la navigation de l'application,
// pour les distinguer de celles qu'une page ajoute elle-même (questions
// d'accueil, vue d'un salon sur mobile).
export const ROUTER_STATE_KEY = "kemetRouter";
const SCROLL_STATE_KEY = "kemetScrollY";

// Adresses servies par le serveur, jamais par l'application.
const SERVER_PATH = /^\/(api|realtime|socket\.io|brand|assets|seed)(\/|$)/;
const FILE_PATH = /\.[a-z0-9]{2,5}$/i;

export interface NavigateEventDetail {
  replace: boolean;
}

function historyState(): Record<string, unknown> {
  return (window.history.state as Record<string, unknown> | null) ?? {};
}

/** Adresse interne à l'application, ou null pour laisser le navigateur faire. */
export function appPathFrom(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (SERVER_PATH.test(url.pathname) || FILE_PATH.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}

export function navigate(href: string, options: { replace?: boolean } = {}) {
  const path = appPathFrom(href);
  if (!path) {
    if (options.replace) window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  const replace = options.replace ?? false;
  // Une nouvelle version attend : changer de page la charge en entier, plutôt
  // que de demander à l'ancienne des morceaux qui n'existent plus.
  if (hasWaitingUpdate()) {
    loadWithNewVersion(path, replace);
    return;
  }
  if (replace) {
    window.history.replaceState({ [ROUTER_STATE_KEY]: true }, "", path);
  } else {
    // La position de lecture reste sur l'entrée quittée, rendue au retour.
    rememberHeights();
    window.history.replaceState({ ...historyState(), [SCROLL_STATE_KEY]: window.scrollY }, "");
    window.history.pushState({ [ROUTER_STATE_KEY]: true }, "", path);
  }
  window.dispatchEvent(
    new CustomEvent<NavigateEventDetail>(NAVIGATE_EVENT, { detail: { replace } }),
  );
}

export function markInitialEntry() {
  window.history.replaceState({ ...historyState(), [ROUTER_STATE_KEY]: true }, "");
}

export function isRouterEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && ROUTER_STATE_KEY in state;
}

export function savedScrollY(): number {
  const value = historyState()[SCROLL_STATE_KEY];
  return typeof value === "number" ? value : 0;
}

function anchorFrom(event: Event): HTMLAnchorElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest("a");
}

/** Lien qu'un clic ordinaire doit suivre sans recharger le document. */
export function routableHref(anchor: HTMLAnchorElement): string | null {
  if (anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;
  return appPathFrom(anchor.href);
}

export function handleDocumentClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = anchorFrom(event);
  if (!anchor) return;
  const path = routableHref(anchor);
  if (!path) return;
  const url = new URL(path, window.location.href);
  // Une ancre sur la même page : le navigateur sait faire.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  )
    return;
  event.preventDefault();
  navigate(path);
}

/** Lien survolé, approché au clavier ou touché : son adresse, pour précharger la page. */
export function intentPathFrom(event: Event): string | null {
  const anchor = anchorFrom(event);
  return anchor ? routableHref(anchor) : null;
}
