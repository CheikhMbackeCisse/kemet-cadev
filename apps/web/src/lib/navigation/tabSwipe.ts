import { useEffect, useLayoutEffect, useRef } from "react";
import { MOBILE_TABS, mobileTabHref } from "../../components/shell/mobileTabs.js";
import { navigate } from "./navigate.js";

export type SwipeDirection = "next" | "previous";

export interface TabSwipeDetail {
  direction: SwipeDirection;
}

/**
 * Émis à chaque glissement reconnu. Des onglets internes (`Tabs swipeable`)
 * le prennent d'abord et l'annulent ; sinon, la barre du bas change d'onglet.
 */
export const TAB_SWIPE_EVENT = "kemet:tab-swipe";

// Un geste franc : assez long, nettement plus horizontal que vertical, et
// rapide. Un défilement lent qui dérive sur le côté n'en est pas un.
const MIN_DISTANCE = 72;
const MAX_DURATION_MS = 600;
const HORIZONTAL_RATIO = 2;
// Le bord gauche appartient au retour du navigateur et au retour d'un salon.
const EDGE_WIDTH = 24;
// Le temps que la page voisine se monte : seul ce qui apparaît pendant ce
// délai glisse, l'animation elle-même dure 180 ms (index.css).
const TRANSITION_WINDOW_MS = 800;

const BLOCKING_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "pre",
  "code",
  "video",
  "audio",
  "[role='dialog']",
  "[role='slider']",
  "[data-no-tab-swipe]",
].join(",");

export interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function classifySwipe(start: TouchPoint, end: TouchPoint): SwipeDirection | null {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  if (start.x <= EDGE_WIDTH) return null;
  if (end.time - start.time > MAX_DURATION_MS) return null;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < dy * HORIZONTAL_RATIO) return null;
  return dx < 0 ? "next" : "previous";
}

// Une liste qui défile en hauteur passe aussi en overflow-x: auto, et un
// anneau de focus la fait déborder de quelques pixels : ce n'est pas une
// rangée qu'on fait défiler au doigt.
const MIN_HORIZONTAL_OVERFLOW = 16;

function scrollsHorizontally(element: Element): boolean {
  if (element.scrollWidth - element.clientWidth < MIN_HORIZONTAL_OVERFLOW) return false;
  const overflow = getComputedStyle(element).overflowX;
  return overflow === "auto" || overflow === "scroll";
}

/** Champ, code, galerie, barre de filtres qui défile, dialogue : le geste leur appartient. */
export function isSwipeBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest(BLOCKING_SELECTOR)) return true;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (scrollsHorizontally(element)) return true;
  }
  return false;
}

export function neighbourTab(activeTabId: string, direction: SwipeDirection): string | null {
  const index = MOBILE_TABS.findIndex((tab) => tab.id === activeTabId);
  if (index === -1) return null;
  return MOBILE_TABS[index + (direction === "next" ? 1 : -1)]?.id ?? null;
}

function markTransition(direction: SwipeDirection, scope: "page" | "inner") {
  const root = document.documentElement;
  const key = scope === "page" ? "tabSwipe" : "tabSwipeInner";
  // La page qu'on quitte ne glisse pas : seule la nouvelle entre.
  if (scope === "page") {
    for (const main of document.querySelectorAll("main")) main.dataset.swipeLeaving = "";
  }
  root.dataset[key] = direction;
  window.setTimeout(() => delete root.dataset[key], TRANSITION_WINDOW_MS);
}

/**
 * Glisser vers la gauche ou la droite sur téléphone change d'onglet interne,
 * sinon passe à l'onglet voisin de la barre du bas quand `navigateTabs` est
 * vrai (page racine d'un onglet, jamais un salon ou une conversation ouverts).
 * Rien sur ordinateur ni avec le mouvement réduit.
 */
export function useTabSwipe(navigateTabs: boolean, activeTabId: string) {
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let start: TouchPoint | null = null;

    function onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      start =
        event.touches.length === 1 &&
        touch &&
        phone.matches &&
        !reducedMotion.matches &&
        !isSwipeBlocked(event.target)
          ? { x: touch.clientX, y: touch.clientY, time: event.timeStamp }
          : null;
    }

    function onTouchEnd(event: TouchEvent) {
      const origin = start;
      start = null;
      const touch = event.changedTouches[0];
      if (!origin || !touch) return;
      const direction = classifySwipe(origin, {
        x: touch.clientX,
        y: touch.clientY,
        time: event.timeStamp,
      });
      if (!direction) return;
      const swipe = new CustomEvent<TabSwipeDetail>(TAB_SWIPE_EVENT, {
        detail: { direction },
        cancelable: true,
      });
      if (!window.dispatchEvent(swipe)) {
        markTransition(direction, "inner");
        return;
      }
      const target = navigateTabs ? neighbourTab(activeTabId, direction) : null;
      if (!target) return;
      markTransition(direction, "page");
      navigate(mobileTabHref(target));
    }

    function onTouchCancel() {
      start = null;
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [navigateTabs, activeTabId]);
}

/** Pour des onglets internes : passe à l'onglet voisin et garde le geste pour eux. */
export function useInnerTabSwipe(
  enabled: boolean,
  values: readonly string[],
  value: string,
  onValueChange: (value: string) => void,
) {
  // Lu par l'écouteur au moment du geste : un second glissement juste après
  // le premier part de l'onglet affiché, pas de celui d'avant.
  const latest = useRef({ values, value, onValueChange });
  useLayoutEffect(() => {
    latest.current = { values, value, onValueChange };
  });

  useEffect(() => {
    if (!enabled) return;
    function onSwipe(event: Event) {
      const { direction } = (event as CustomEvent<TabSwipeDetail>).detail;
      const { values, value, onValueChange } = latest.current;
      const index = values.indexOf(value);
      const next = values[index + (direction === "next" ? 1 : -1)];
      if (index === -1 || next === undefined) return;
      event.preventDefault();
      onValueChange(next);
    }
    window.addEventListener(TAB_SWIPE_EVENT, onSwipe);
    return () => window.removeEventListener(TAB_SWIPE_EVENT, onSwipe);
  }, [enabled]);
}
