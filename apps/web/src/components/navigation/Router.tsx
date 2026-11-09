import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { fr } from "../../i18n/fr.js";
import { Button } from "../ui/Button.js";
import {
  handleDocumentClick,
  intentPathFrom,
  isRouterEntry,
  markInitialEntry,
  NAVIGATE_EVENT,
  savedScrollY,
} from "../../lib/navigation/navigate.js";
import { MAIN_SECTION_PATHS, pageFor, preloadPage } from "../../lib/navigation/pages.js";

interface RenderedLocation {
  pathname: string;
  search: string;
  /** Change à chaque navigation : la page suivante repart de zéro, comme après un chargement. */
  id: number;
  via: "initial" | "push" | "pop";
}

function readLocation(id: number, via: RenderedLocation["via"]): RenderedLocation {
  return { pathname: window.location.pathname, search: window.location.search, id, via };
}

function whenIdle(callback: () => void) {
  if ("requestIdleCallback" in window) window.requestIdleCallback(callback, { timeout: 4000 });
  else setTimeout(callback, 1500);
}

function usePreloading() {
  useEffect(() => {
    whenIdle(() => MAIN_SECTION_PATHS.forEach(preloadPage));
    const onIntent = (event: Event) => {
      const path = intentPathFrom(event);
      if (path) preloadPage(path);
    };
    document.addEventListener("mouseover", onIntent);
    document.addEventListener("focusin", onIntent);
    document.addEventListener("touchstart", onIntent, { passive: true });
    return () => {
      document.removeEventListener("mouseover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("touchstart", onIntent);
    };
  }, []);
}

/** Code d'une page impossible à charger (réseau coupé, fichiers d'une version remplacée). */
class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 pt-12">
        <p className="text-base text-text">{fr.shell.pageLoadFailed}</p>
        <Button onClick={() => window.location.reload()}>{fr.shell.reload}</Button>
      </div>
    );
  }
}

/**
 * Sans rechargement, rien n'annonce plus la nouvelle page : le focus passe à
 * son titre, qui devient aussi celui de l'onglet et est lu par la région live.
 */
function useAnnounceNavigation(
  location: RenderedLocation,
  announcer: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (location.via === "initial") return;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1, h1");
      const target = heading ?? document.querySelector<HTMLElement>("main");
      const title = heading?.textContent?.trim();
      if (target) {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
      if (announcer.current) announcer.current.textContent = title ?? "";
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location, announcer]);
}

function readDocumentTitle(): string {
  const title = document.querySelector<HTMLElement>("main h1, h1")?.textContent?.trim();
  return title ? fr.shell.documentTitle(title) : "Kemet";
}

// Le titre d'une page n'existe souvent qu'une fois ses données chargées : on
// suit le document plutôt que de le lire une seule fois après la navigation.
function useDocumentTitle() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readDocumentTitle();
        if (document.title !== next) document.title = next;
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);
}

/**
 * Rend la page de l'adresse courante et suit la navigation de l'application
 * sans recharger le document. Le passage d'une page à l'autre se fait dans
 * une transition : l'écran précédent reste affiché, une fine barre en haut
 * signale l'attente, jusqu'à ce que la suivante soit prête.
 */
export function Router({
  render,
  fallback,
}: {
  render: (pathname: string) => ReactNode;
  fallback: ReactNode;
}) {
  const [location, setLocation] = useState(() => readLocation(0, "initial"));
  const [pending, startTransition] = useTransition();
  const current = useRef(location);
  current.current = location;

  const announcer = useRef<HTMLDivElement>(null);
  usePreloading();
  useAnnounceNavigation(location, announcer);
  useDocumentTitle();

  useEffect(() => {
    markInitialEntry();
    const onNavigate = () => {
      startTransition(() => setLocation(readLocation(current.current.id + 1, "push")));
    };
    const onPopState = (event: PopStateEvent) => {
      const shown = current.current;
      const samePage = pageFor(window.location.pathname) === pageFor(shown.pathname);
      const sameAddress =
        window.location.pathname === shown.pathname && window.location.search === shown.search;
      // Une entrée ajoutée par la page elle-même (question suivante, vue d'un
      // salon sur mobile) se gère dans la page.
      if (samePage && (sameAddress || !isRouterEntry(event.state))) return;
      startTransition(() => setLocation(readLocation(shown.id + 1, "pop")));
    };
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useLayoutEffect(() => {
    if (location.via === "push") window.scrollTo(0, 0);
    if (location.via === "pop") window.scrollTo(0, savedScrollY());
  }, [location]);

  return (
    <>
      {pending && <div className="navigation-progress" role="presentation" />}
      <div ref={announcer} className="sr-only" aria-live="polite" />
      <PageErrorBoundary key={location.id}>
        <Suspense fallback={fallback}>{render(location.pathname)}</Suspense>
      </PageErrorBoundary>
    </>
  );
}
