import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.js";
import { KemetWordmark } from "../ui/KemetWordmark.js";
import { markIntroSeen } from "../../lib/intro/introStorage.js";
import type { ArrivalMotion } from "./ArrivalBackground.js";
import { usePageVisible, useStillBackground } from "./ArrivalBackdrop.js";
import { ArrivalDecorBand } from "./ArrivalDecor.js";
import { ProfileUniverse } from "./ProfileUniverse.js";
import { AFRICA_OUTLINE_WIDTH } from "./africaOutline.js";
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
  /**
   * "bands" : le décor dans deux bandes autour de la carte. "universe" :
   * l'univers à trois profondeurs de "Complète ton profil", tout autour.
   */
  decor?: "bands" | "universe";
  /**
   * La carte tient dans la hauteur de l'écran : son contenu gère lui-même
   * son défilement (une liste longue entre un titre et un bouton fixes).
   */
  fitViewport?: boolean;
  /** Carte plus transparente, pour l'accueil seul : un formulaire garde le verre dépoli. */
  clearCard?: boolean;
  busy?: boolean;
  children: ReactNode;
}

// Marge autour de la carte : le halo d'un point qui la touche passerait
// derrière le texte.
const DOT_CLEARANCE = 12;
// Marge autour d'un élément du décor, dérive comprise.
const DECOR_CLEARANCE = DECOR_DRIFT + 10;

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
 * derrière le texte. Un élément du décor posé sur une capitale ou une ville
 * visible est caché ; il peut passer près d'un arc, plus pâle que le contour.
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
      // Le fond vit hors de la page (ArrivalBackdrop, monté par le routeur).
      const watermark = document.querySelector(".africa-watermark-network");
      if (!watermark) return;
      const box = cardElement!.getBoundingClientRect();
      const area = watermark.getBoundingClientRect();
      const scale = area.width / AFRICA_OUTLINE_WIDTH;
      const visible: Array<{ x: number; y: number }> = [];

      document.querySelectorAll<HTMLElement>(".network-dot").forEach((dot) => {
        const { left, top, width, height } = dot.getBoundingClientRect();
        const x = left + width / 2;
        const y = top + height / 2;
        const covered = inside(box, x, y, DOT_CLEARANCE);
        dot.toggleAttribute("data-covered", covered);
        if (!covered) visible.push({ x, y });
      });

      const zone = document.querySelector(`.${NETWORK_COVERED_ZONE_CLASS}`);
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
 * Gabarit du parcours d'arrivée : logo en haut, contenu sur
 * une carte en verre dépoli au centre, entre deux bandes de décor. Le texte
 * de la carte est blanc dans les deux thèmes, le fond restant sombre ; les
 * champs gardent leurs couleurs ordinaires. Le fond lui-même (dégradé,
 * continent, réseau) est posé par ArrivalBackdrop, hors de la page, pour ne
 * pas se démonter d'un écran à l'autre.
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
  decor = "bands",
  fitViewport = false,
  clearCard = false,
  busy,
  children,
}: ArrivalLayoutProps) {
  const visible = usePageVisible();
  const still = useStillBackground();
  const hasHeader = showLogo || headerEnd !== undefined;
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useNetworkAroundCard(root, card, motion === "rich" && !busy);

  return (
    <div
      ref={root}
      className={cn(
        "arrival-root relative flex w-full flex-col",
        fitViewport ? "h-viewport" : "min-h-viewport",
      )}
      data-paused={visible ? undefined : ""}
      data-still={still ? "" : undefined}
      aria-busy={busy || undefined}
    >
      {decor === "universe" && !busy && <ProfileUniverse card={card} />}

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
        <div
          className={cn(
            "arrival-stage relative z-10 flex-1",
            `arrival-stage-${width}`,
            fitViewport && "arrival-stage-fit",
          )}
        >
          {decor === "bands" ? <ArrivalDecorBand side="start" motion={motion} /> : <div />}
          <main className="flex min-h-0 min-w-0 flex-col items-center justify-center px-4 py-4 sm:py-8">
            <div className="flex max-h-full min-h-0 w-full flex-col gap-3">
              <div
                ref={card}
                className={cn(
                  "arrival-glass auth-on-dark flex min-h-0 flex-col gap-4 rounded-panel p-5 text-auth-text sm:p-8",
                  clearCard && "arrival-glass-clear",
                )}
              >
                {children}
              </div>
              {footer && <div className="auth-on-dark">{footer}</div>}
            </div>
          </main>
          {decor === "bands" ? <ArrivalDecorBand side="end" motion={motion} /> : <div />}
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
