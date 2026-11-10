import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "../../lib/cn.js";
import { isSlowConnection } from "../../lib/network.js";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { markIntroSeen } from "../../lib/intro/introStorage.js";
import { ArrivalBackground, type ArrivalMotion } from "./ArrivalBackground.js";
import { ArrivalDecorBand } from "./ArrivalDecor.js";
import { AFRICA_OUTLINE_WIDTH } from "./africaOutline.js";
import { NETWORK_ARCS, arcSamples } from "./networkLayout.js";
import { NETWORK_COVERED_ZONE_CLASS } from "./AfricaNetwork.js";
import { DECOR_DRIFT } from "./decorLayout.js";

export interface ArrivalLayoutProps {
  motion: ArrivalMotion;
  /**
   * Largeur de la carte : "sm" pour l'accueil, dont le réseau doit se voir
   * autour, "md" pour un formulaire, "lg" pour une grille de choix.
   */
  width?: "sm" | "md" | "lg";
  /** Posé à droite du logo, comme le lien de retour vers l'application. */
  headerEnd?: ReactNode;
  /** Sous la carte, sur le fond. */
  footer?: ReactNode;
  /** Tout en bas de l'écran, hors de la carte. */
  pageFooter?: ReactNode;
  /** Faux sur l'accueil, où le logo complet est déjà sur la carte. */
  showLogo?: boolean;
  busy?: boolean;
  children: ReactNode;
}

// public/theme-init.js pose ce fond sombre avant le premier affichage ; il
// doit suivre le parcours quand on en sort sans recharger le document.
function useArrivalDocumentBackground() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-arrival", "");
    return () => document.documentElement.removeAttribute("data-arrival");
  }, []);
}

/** Vrai tant que l'onglet est visible : un fond animé caché ne doit rien coûter. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

// Marge autour de la carte : le halo d'un point qui la touche passerait
// derrière le texte.
const DOT_CLEARANCE = 12;
// Marge autour d'un élément du décor, dérive comprise.
const DECOR_CLEARANCE = DECOR_DRIFT + 10;
// Points pris sur chaque arc pour savoir si le décor le croise.
const ARC_SAMPLES = 24;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function inside(box: Box, x: number, y: number, margin: number): boolean {
  return (
    x > box.left - margin &&
    x < box.right + margin &&
    y > box.top - margin &&
    y < box.bottom + margin
  );
}

/**
 * Réseau de l'accueil autour de la carte, recalculé à chaque changement de
 * taille de l'écran ou de la carte. Un point ou une lueur que la carte
 * couvre s'atténue : à pleine intensité, il se lirait comme une poussière
 * derrière le texte. Un élément du décor posé sur une capitale, une ville
 * ou un arc visible est caché.
 */
function useNetworkAroundCard(
  root: RefObject<HTMLElement>,
  card: RefObject<HTMLElement>,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    const rootElement = root.current;
    const cardElement = card.current;
    if (!enabled || !rootElement || !cardElement) return;
    function update() {
      const watermark = rootElement!.querySelector(".africa-watermark-network");
      if (!watermark) return;
      const box = cardElement!.getBoundingClientRect();
      const area = watermark.getBoundingClientRect();
      const scale = area.width / AFRICA_OUTLINE_WIDTH;
      const visible: Array<{ x: number; y: number }> = [];

      rootElement!.querySelectorAll<HTMLElement>(".network-dot").forEach((dot) => {
        const { left, top, width, height } = dot.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const covered = inside(box, x, y, DOT_CLEARANCE);
        dot.toggleAttribute("data-covered", covered);
        if (!covered) visible.push({ x, y });
      });
      for (const arc of NETWORK_ARCS) {
        for (const point of arcSamples(arc, ARC_SAMPLES)) {
          const x = area.left + point.x * scale;
          const y = area.top + point.y * scale;
          if (!inside(box, x, y, 0)) visible.push({ x, y });
        }
      }

      const zone = rootElement!.querySelector(`.${NETWORK_COVERED_ZONE_CLASS}`);
      if (zone && scale > 0) {
        zone.setAttribute("x", String((box.left - area.left) / scale));
        zone.setAttribute("y", String((box.top - area.top) / scale));
        zone.setAttribute("width", String(box.width / scale));
        zone.setAttribute("height", String(box.height / scale));
      }

      rootElement!.querySelectorAll<HTMLElement>(".arrival-decor-item").forEach((item) => {
        const itemBox = item.getBoundingClientRect();
        if (itemBox.width === 0) return;
        const clash = visible.some((point) => inside(itemBox, point.x, point.y, DECOR_CLEARANCE));
        item.toggleAttribute("data-clash", clash);
      });
    }
    // Le fond est fixe et la carte défile (téléphone en paysage), ou la
    // hauteur visible change avec les barres de Safari : on remesure aussi,
    // une fois par image au plus.
    let frame = 0;
    function schedule() {
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
      }
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(cardElement);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [root, card, enabled]);
}

/**
 * Gabarit du parcours d'arrivée : fond de marque, logo en haut, contenu sur
 * une carte en verre dépoli au centre, entre deux bandes de décor. Le texte
 * de la carte est blanc dans les deux thèmes, le fond restant sombre ; les
 * champs gardent leurs couleurs ordinaires.
 * Sur connexion lente ou en économie de données, rien ne bouge : le
 * téléphone a déjà assez à faire avec le téléchargement de la page.
 */
export function ArrivalLayout({
  motion,
  width = "md",
  headerEnd,
  footer,
  pageFooter,
  showLogo = true,
  busy,
  children,
}: ArrivalLayoutProps) {
  useArrivalDocumentBackground();
  const visible = usePageVisible();
  const [still] = useState(isSlowConnection);
  const hasHeader = showLogo || headerEnd !== undefined;
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useNetworkAroundCard(root, card, motion === "rich" && !busy);

  return (
    <div
      ref={root}
      className="arrival-root relative flex min-h-viewport w-full flex-col"
      data-paused={visible ? undefined : ""}
      data-still={still ? "" : undefined}
      aria-busy={busy || undefined}
    >
      <ArrivalBackground motion={motion} />

      {hasHeader ? (
        <header className="auth-on-dark relative z-10 flex w-full items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          {showLogo ? (
            <a
              href="/fil"
              onClick={markIntroSeen}
              className="kemet-on-dark flex min-h-control-mobile items-center md:min-h-control"
            >
              <KemetWordmark className="h-6 w-auto" />
            </a>
          ) : (
            <span />
          )}
          {headerEnd}
        </header>
      ) : (
        // Même hauteur que le pied de page : la carte reste au centre exact
        // de l'écran, sur le continent.
        pageFooter && <div aria-hidden="true" className="arrival-footer-space" />
      )}

      {!busy && (
        <div className={cn("arrival-stage relative z-10 flex-1", `arrival-stage-${width}`)}>
          <ArrivalDecorBand side="start" motion={motion} />
          <main className="flex min-w-0 flex-col items-center justify-center px-4 py-4 sm:py-8">
            <div className="flex w-full flex-col gap-3">
              <div
                ref={card}
                className={cn(
                  "arrival-glass auth-on-dark flex flex-col gap-4 rounded-panel p-5 text-auth-text sm:p-8",
                  motion === "rich" && "arrival-glass-clear",
                )}
              >
                {children}
              </div>
              {footer && <div className="auth-on-dark">{footer}</div>}
            </div>
          </main>
          <ArrivalDecorBand side="end" motion={motion} />
        </div>
      )}
      {!busy && pageFooter && (
        <footer className="arrival-footer-space auth-on-dark relative z-10 flex items-center justify-center px-4 pb-[env(safe-area-inset-bottom)]">
          {pageFooter}
        </footer>
      )}
    </div>
  );
}
