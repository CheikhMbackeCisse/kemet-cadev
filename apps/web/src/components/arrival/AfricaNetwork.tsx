import type { AnimationEvent, CSSProperties } from "react";
import {
  AFRICA_CAPITALS,
  AFRICA_CITIES,
  AFRICA_OUTLINE_HEIGHT,
  AFRICA_OUTLINE_WIDTH,
} from "./africaOutline.js";
import { NETWORK_ARCS, arcPath, glowTurn } from "./networkLayout.js";

// Six lueurs, décalées d'un sixième de leur cycle de 3,6 s (index.css,
// network-glow) : quatre ou cinq voyagent à la fois, chacune en 2,5 s. Sur
// téléphone, une sur deux est masquée : trois au plus.
const GLOW_SLOTS = 6;
const GLOW_CYCLE_SECONDS = 3.6;
// Longueur d'une lueur, en unités de la boîte du contour.
const GLOW_LENGTH = 20;

/** Zone de la carte dans le masque des lueurs, posée par ArrivalLayout. */
export const NETWORK_COVERED_ZONE_CLASS = "network-covered-zone";

let nextTurn = GLOW_SLOTS;

function glowAttributes(turn: number) {
  const { arc, reverse } = glowTurn(turn);
  // pathLength ramène chaque arc à 100 : la lueur garde la même longueur à
  // l'écran quel que soit l'arc.
  const dash = ((GLOW_LENGTH / arc.length) * 100).toFixed(2);
  return { d: arcPath(arc, reverse), dasharray: `${dash} 200` };
}

// À chaque fin de voyage, la lueur passe à l'arc suivant. Les attributs sont
// posés directement : React n'a rien à redessiner.
function moveGlow(event: AnimationEvent<SVGGElement>) {
  const { d, dasharray } = glowAttributes(nextTurn);
  nextTurn += 1;
  event.currentTarget.setAttribute("stroke-dasharray", dasharray);
  event.currentTarget.querySelectorAll("path").forEach((path) => path.setAttribute("d", d));
}

function percent(value: number, size: number): string {
  return `${((value / size) * 100).toFixed(2)}%`;
}

function dotStyle(x: number, y: number): CSSProperties {
  return { left: percent(x, AFRICA_OUTLINE_WIDTH), top: percent(y, AFRICA_OUTLINE_HEIGHT) };
}

/**
 * Arcs et lueurs du réseau, dans le SVG du continent (même repère). Les
 * lueurs passent sous un masque : sous la carte, elles s'atténuent comme les
 * capitales qu'elle couvre.
 */
export function NetworkArcs() {
  return (
    <>
      <defs>
        <mask
          id="africa-network-mask"
          maskUnits="userSpaceOnUse"
          x={-AFRICA_OUTLINE_WIDTH}
          y={-AFRICA_OUTLINE_HEIGHT}
          width={AFRICA_OUTLINE_WIDTH * 3}
          height={AFRICA_OUTLINE_HEIGHT * 3}
        >
          <rect
            x={-AFRICA_OUTLINE_WIDTH}
            y={-AFRICA_OUTLINE_HEIGHT}
            width={AFRICA_OUTLINE_WIDTH * 3}
            height={AFRICA_OUTLINE_HEIGHT * 3}
            fill="white"
          />
          <rect className={NETWORK_COVERED_ZONE_CLASS} width="0" height="0" />
        </mask>
      </defs>
      <g fill="none" strokeLinecap="round">
        {NETWORK_ARCS.map((arc) => (
          <path
            key={arc.key}
            className="network-arc"
            d={arcPath(arc)}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <g mask="url(#africa-network-mask)" fill="none" strokeLinecap="round">
        {Array.from({ length: GLOW_SLOTS }, (_, slot) => {
          const { d, dasharray } = glowAttributes(slot);
          return (
            <g
              key={slot}
              className="network-glow"
              strokeDasharray={dasharray}
              style={{ animationDelay: `${(slot * -GLOW_CYCLE_SECONDS) / GLOW_SLOTS}s` }}
              onAnimationIteration={moveGlow}
            >
              <path className="network-glow-halo" d={d} pathLength={100} />
              <path className="network-glow-core" d={d} pathLength={100} />
            </g>
          );
        })}
      </g>
    </>
  );
}

/** Capitales en points lumineux, autres grandes villes en points pâles. */
export function NetworkDots() {
  return (
    <>
      {AFRICA_CITIES.map((city) => (
        <span key={city.id} className="network-dot city-dot" style={dotStyle(city.x, city.y)} />
      ))}
      {AFRICA_CAPITALS.map((capital) => (
        <span
          key={capital.id}
          className="network-dot capital-dot"
          style={dotStyle(capital.x, capital.y)}
        />
      ))}
    </>
  );
}
