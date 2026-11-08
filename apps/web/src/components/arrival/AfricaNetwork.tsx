import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { CAPITALS, NETWORK_LINKS, type Capital } from "./africaCapitals.js";
import { AFRICA_OUTLINE_PATH } from "./africaOutline.js";

// Boîte du continent dans le repère du contour (1000 sur 1000), avec une
// marge pour le halo des capitales au bord.
const BOX = { x: 117, y: -20, width: 766, height: 1040 };

// Une liaison s'allume toutes les 0,6 s et reste allumée 2,2 s : quatre au
// plus à la fois. Une capitale bat toutes les 0,45 s, pendant 2,4 s.
const LINK_EVERY_MS = 600;
const LINK_LIT_MS = 2200;
const PULSE_EVERY_MS = 450;
const PULSE_MS = 2400;
// Pas de mélange de l'ordre, premier avec le nombre d'éléments : deux
// liaisons qui se suivent ne sont jamais au même endroit.
const ORDER_STEP = 17;

const BY_ID = new Map(CAPITALS.map((capital) => [capital.id, capital]));

// Marge autour d'une liaison allumée, pour son halo.
const LINK_PADDING = 8;

function curve(from: Capital, to: Capital) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Légère courbe, toujours du même côté : un réseau plutôt qu'une grille.
  const bend = 0.18;
  const cx = (from.x + to.x) / 2 - dy * bend;
  const cy = (from.y + to.y) / 2 + dx * bend;
  const xs = [from.x, cx, to.x];
  const ys = [from.y, cy, to.y];
  return {
    d: `M${from.x} ${from.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`,
    // Boîte du point de contrôle compris : elle contient toujours la courbe.
    box: {
      x: Math.min(...xs) - LINK_PADDING,
      y: Math.min(...ys) - LINK_PADDING,
      width: Math.max(...xs) - Math.min(...xs) + 2 * LINK_PADDING,
      height: Math.max(...ys) - Math.min(...ys) + 2 * LINK_PADDING,
    },
  };
}

const LINKS = NETWORK_LINKS.map(([fromId, toId]) => ({
  key: `${fromId}-${toId}`,
  ...curve(BY_ID.get(fromId)!, BY_ID.get(toId)!),
}));

/**
 * Allume les liaisons et fait battre les capitales à tour de rôle. Une
 * animation CSS infinie par élément gardait 76 animations actives à chaque
 * image ; ici, seules les quelques-unes en cours tournent. Les classes sont
 * posées directement, sans rendu React.
 */
function useNetworkSequence(container: React.RefObject<HTMLDivElement>, paused: boolean) {
  useEffect(() => {
    const root = container.current;
    if (!root || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const links = root.querySelectorAll<SVGElement>(".network-link");
    const dots = root.querySelectorAll<HTMLElement>(".capital-dot");
    const timeouts = new Set<number>();
    let linkTurn = 0;
    let dotTurn = 0;

    function flash(element: Element | undefined, className: string, duration: number) {
      if (!element) return;
      element.classList.add(className);
      const timeout = window.setTimeout(() => {
        element.classList.remove(className);
        timeouts.delete(timeout);
      }, duration);
      timeouts.add(timeout);
    }

    const linkTimer = window.setInterval(() => {
      flash(links[(linkTurn * ORDER_STEP) % links.length], "is-lit", LINK_LIT_MS);
      linkTurn += 1;
    }, LINK_EVERY_MS);
    const dotTimer = window.setInterval(() => {
      flash(dots[(dotTurn * ORDER_STEP) % dots.length], "is-pulsing", PULSE_MS);
      dotTurn += 1;
    }, PULSE_EVERY_MS);

    return () => {
      window.clearInterval(linkTimer);
      window.clearInterval(dotTimer);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      root.querySelectorAll(".is-lit, .is-pulsing").forEach((element) => {
        element.classList.remove("is-lit", "is-pulsing");
      });
    };
  }, [container, paused]);
}

function percent(value: number, origin: number, size: number): string {
  return `${(((value - origin) / size) * 100).toFixed(3)}%`;
}

/**
 * Le continent au centre de l'accueil : ses capitales qui pulsent doucement
 * et un réseau de liaisons qui s'allument puis s'éteignent, une à une.
 * Chaque liaison allumée est un petit SVG à part : seules transform et
 * opacity bougent, le continent n'est jamais redessiné. Tout s'arrête avec
 * l'onglet caché et reste fixe si le système demande moins de mouvement.
 * Purement décoratif.
 */
export function AfricaNetwork({
  className,
  paused = false,
}: {
  className?: string;
  paused?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  useNetworkSequence(container, paused);
  return (
    <div
      ref={container}
      className={cn("africa-network relative", className)}
      style={{ aspectRatio: `${BOX.width} / ${BOX.height}` }}
    >
      <svg
        viewBox={`${BOX.x} ${BOX.y} ${BOX.width} ${BOX.height}`}
        className="absolute inset-0 size-full overflow-visible"
      >
        <defs>
          <linearGradient id="africa-fill" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="var(--auth-network-fill-from)" stopOpacity="0.30" />
            <stop offset="1" stopColor="var(--auth-network-fill-to)" stopOpacity="0.10" />
          </linearGradient>
        </defs>
        <path
          d={AFRICA_OUTLINE_PATH}
          fill="url(#africa-fill)"
          stroke="var(--auth-network-line)"
          strokeOpacity="0.45"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <g fill="none" strokeLinecap="round">
          {LINKS.map((link) => (
            <path
              key={link.key}
              d={link.d}
              stroke="var(--auth-network-line)"
              strokeOpacity="0.16"
              strokeWidth="1.5"
            />
          ))}
        </g>
      </svg>

      {LINKS.map((link) => (
        <svg
          key={link.key}
          viewBox={`${link.box.x} ${link.box.y} ${link.box.width} ${link.box.height}`}
          className="network-link absolute overflow-visible"
          fill="none"
          strokeLinecap="round"
          style={
            {
              left: percent(link.box.x, BOX.x, BOX.width),
              top: percent(link.box.y, BOX.y, BOX.height),
              width: percent(link.box.x + link.box.width, link.box.x, BOX.width),
              height: percent(link.box.y + link.box.height, link.box.y, BOX.height),
            } as CSSProperties
          }
        >
          <path d={link.d} stroke="var(--auth-network-glow)" strokeOpacity="0.35" strokeWidth="7" />
          <path d={link.d} stroke="var(--auth-network-core)" strokeWidth="2.2" />
        </svg>
      ))}

      {CAPITALS.map((capital) => (
        <span
          key={capital.id}
          className="capital-dot"
          style={
            {
              left: percent(capital.x, BOX.x, BOX.width),
              top: percent(capital.y, BOX.y, BOX.height),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
