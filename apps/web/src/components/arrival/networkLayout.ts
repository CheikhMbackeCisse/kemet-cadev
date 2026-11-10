import { AFRICA_CAPITALS, type AfricaPlace } from "./africaOutline.js";

/**
 * Liaisons du réseau de l'accueil : chaque capitale à deux ou trois de ses
 * voisines, du Maghreb au Cap et de Dakar à la Corne. Chaque paire est
 * écrite dans le sens qui courbe l'arc vers l'intérieur des terres.
 */
export const NETWORK_LINKS: ReadonlyArray<readonly [string, string]> = [
  ["rabat", "alger"],
  ["alger", "tunis"],
  ["tunis", "caire"],
  ["dakar", "rabat"],
  ["bamako", "rabat"],
  ["dakar", "bamako"],
  ["bamako", "abuja"],
  ["abuja", "khartoum"],
  ["caire", "khartoum"],
  ["khartoum", "addis"],
  ["addis", "nairobi"],
  ["luanda", "abuja"],
  ["nairobi", "lusaka"],
  ["luanda", "lusaka"],
  ["lusaka", "maputo"],
  ["maputo", "pretoria"],
  ["pretoria", "luanda"],
];

// Courbure d'un arc : écart du point de contrôle, en part de la longueur.
const BEND = 0.14;

export interface NetworkArc {
  key: string;
  from: AfricaPlace;
  to: AfricaPlace;
  control: { x: number; y: number };
  /** Longueur approchée, en unités de la boîte du contour. */
  length: number;
}

const BY_ID = new Map(AFRICA_CAPITALS.map((capital) => [capital.id, capital]));

function place(id: string): AfricaPlace {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Capitale inconnue : ${id}`);
  return found;
}

/** Point de l'arc à `t` (0 au départ, 1 à l'arrivée), courbe de Bézier quadratique. */
export function arcPoint(arc: Pick<NetworkArc, "from" | "to" | "control">, t: number) {
  const u = 1 - t;
  return {
    x: u * u * arc.from.x + 2 * u * t * arc.control.x + t * t * arc.to.x,
    y: u * u * arc.from.y + 2 * u * t * arc.control.y + t * t * arc.to.y,
  };
}

/** `count + 1` points régulièrement espacés en `t`, extrémités comprises. */
export function arcSamples(arc: Pick<NetworkArc, "from" | "to" | "control">, count: number) {
  return Array.from({ length: count + 1 }, (_, index) => arcPoint(arc, index / count));
}

function buildArc(fromId: string, toId: string): NetworkArc {
  const from = place(fromId);
  const to = place(toId);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const control = { x: (from.x + to.x) / 2 - dy * BEND, y: (from.y + to.y) / 2 + dx * BEND };
  const samples = arcSamples({ from, to, control }, 24);
  let length = 0;
  for (let index = 1; index < samples.length; index += 1) {
    length += Math.hypot(
      samples[index]!.x - samples[index - 1]!.x,
      samples[index]!.y - samples[index - 1]!.y,
    );
  }
  return { key: `${fromId}-${toId}`, from, to, control, length };
}

export const NETWORK_ARCS: readonly NetworkArc[] = NETWORK_LINKS.map(([from, to]) =>
  buildArc(from, to),
);

/** Chemin SVG de l'arc, parcouru à l'envers si `reverse`. */
export function arcPath(arc: NetworkArc, reverse = false): string {
  const [start, end] = reverse ? [arc.to, arc.from] : [arc.from, arc.to];
  return `M${start.x} ${start.y}Q${arc.control.x.toFixed(1)} ${arc.control.y.toFixed(1)} ${end.x} ${end.y}`;
}

// Pas premier avec le nombre d'arcs : deux lueurs qui se suivent partent
// d'endroits éloignés, et chaque arc revient une fois par tour.
const GLOW_STEP = 7;

/**
 * Arc et sens de la n-ième lueur : un arc sur deux est parcouru à l'envers,
 * pour que le réseau ne semble pas couler dans un seul sens.
 */
export function glowTurn(turn: number): { arc: NetworkArc; reverse: boolean } {
  const arc = NETWORK_ARCS[(turn * GLOW_STEP) % NETWORK_ARCS.length]!;
  return { arc, reverse: turn % 2 === 1 };
}
