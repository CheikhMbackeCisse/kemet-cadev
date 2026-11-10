/**
 * Régénère apps/web/src/components/arrival/africaOutline.ts : contour du
 * continent africain (pays fusionnés, Madagascar comprise, petites îles
 * écartées) en projection de Mercator, et place les capitales et les villes du réseau de l'accueil.
 * Données : Natural Earth (domaine public) par world-atlas, countries-50m (ISC).
 *
 *   pnpm exec tsx scripts/build-africa-outline.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { geoArea, geoMercator } from "d3-geo";
import { merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MultiPolygon, Position } from "geojson";

const OUTPUT = fileURLToPath(
  new URL("../apps/web/src/components/arrival/africaOutline.ts", import.meta.url),
);
const WIDTH = 1000;
const MAX_BYTES = 20 * 1024;
// Écart toléré entre le tracé simplifié et le tracé d'origine, en unités de
// la boîte (1000 de large) : moins d'un pixel sur un écran de bureau.
const TOLERANCE = 0.9;
// Une île plus petite que cette part du continent est écartée : seule
// Madagascar reste.
const MIN_AREA_SHARE = 0.005;

// Codes ISO 3166 numériques des 54 États d'Afrique et du Sahara occidental.
// Le Somaliland n'a pas de code dans world-atlas : il est repris par son nom.
const AFRICAN_IDS = new Set([
  "012",
  "024",
  "072",
  "108",
  "120",
  "132",
  "140",
  "148",
  "174",
  "178",
  "180",
  "204",
  "226",
  "231",
  "232",
  "262",
  "266",
  "270",
  "288",
  "324",
  "384",
  "404",
  "426",
  "430",
  "434",
  "450",
  "454",
  "466",
  "478",
  "480",
  "504",
  "508",
  "516",
  "562",
  "566",
  "624",
  "646",
  "678",
  "686",
  "690",
  "694",
  "706",
  "710",
  "716",
  "728",
  "729",
  "732",
  "748",
  "768",
  "788",
  "800",
  "818",
  "834",
  "854",
  "894",
]);

// Capitales du réseau de l'accueil, toutes au bord du continent : sur
// ordinateur, le centre est sous la carte de l'accueil (liaisons dans
// apps/web/src/components/arrival/networkLayout.ts), longitude puis latitude.
const CAPITALS = [
  { id: "rabat", name: "Rabat", position: [-6.85, 33.972] },
  { id: "alger", name: "Alger", position: [3.059, 36.754] },
  { id: "tunis", name: "Tunis", position: [10.182, 36.807] },
  { id: "caire", name: "Le Caire", position: [31.236, 30.044] },
  { id: "dakar", name: "Dakar", position: [-17.447, 14.693] },
  { id: "bamako", name: "Bamako", position: [-8.003, 12.639] },
  { id: "tripoli", name: "Tripoli", position: [13.191, 32.887] },
  { id: "khartoum", name: "Khartoum", position: [32.56, 15.501] },
  { id: "addis", name: "Addis-Abeba", position: [38.758, 8.981] },
  { id: "nairobi", name: "Nairobi", position: [36.822, -1.292] },
  { id: "windhoek", name: "Windhoek", position: [17.083, -22.561] },
  { id: "lusaka", name: "Lusaka", position: [28.323, -15.388] },
  { id: "pretoria", name: "Pretoria", position: [28.188, -25.746] },
  { id: "maputo", name: "Maputo", position: [32.573, -25.969] },
] as const;

// Autres grandes villes, sans liaison : de petits points pâles.
const CITIES = [
  { id: "casablanca", name: "Casablanca", position: [-7.59, 33.573] },
  { id: "conakry", name: "Conakry", position: [-13.578, 9.641] },
  { id: "abidjan", name: "Abidjan", position: [-4.008, 5.36] },
  { id: "accra", name: "Accra", position: [-0.187, 5.604] },
  { id: "ouagadougou", name: "Ouagadougou", position: [-1.52, 12.371] },
  { id: "abuja", name: "Abuja", position: [7.399, 9.076] },
  { id: "lagos", name: "Lagos", position: [3.379, 6.524] },
  { id: "kano", name: "Kano", position: [8.592, 12.002] },
  { id: "douala", name: "Douala", position: [9.768, 4.051] },
  { id: "ndjamena", name: "N'Djamena", position: [15.044, 12.135] },
  { id: "kinshasa", name: "Kinshasa", position: [15.266, -4.442] },
  { id: "luanda", name: "Luanda", position: [13.289, -8.839] },
  { id: "kampala", name: "Kampala", position: [32.583, 0.348] },
  { id: "dar", name: "Dar es Salaam", position: [39.208, -6.792] },
  { id: "mogadiscio", name: "Mogadiscio", position: [45.318, 2.047] },
  { id: "harare", name: "Harare", position: [31.053, -17.829] },
  { id: "le-cap", name: "Le Cap", position: [18.424, -33.925] },
  { id: "durban", name: "Durban", position: [31.022, -29.859] },
  { id: "antananarivo", name: "Antananarivo", position: [47.508, -18.879] },
] as const;

type Point = [number, number];

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length),
        );
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}

/** Douglas-Peucker, sans récursion pour les longs anneaux. */
function simplify(points: Point[], tolerance: number): Point[] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let farthestDistance = tolerance;
    for (let index = first + 1; index < last; index += 1) {
      const distance = distanceToSegment(points[index]!, points[first]!, points[last]!);
      if (distance > farthestDistance) {
        farthest = index;
        farthestDistance = distance;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, index) => keep[index] === 1);
}

/** Anneau en chemin relatif, coordonnées entières : le plus court à écrire. */
function ringToPath(ring: Point[]): string {
  const rounded = ring.map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
  const unique = rounded.filter(
    (point, index) =>
      index === 0 || point[0] !== rounded[index - 1]![0] || point[1] !== rounded[index - 1]![1],
  );
  const [start, ...rest] = unique;
  let path = `M${start![0]} ${start![1]}`;
  let previous = start!;
  for (const point of rest) {
    const dx = point[0] - previous[0];
    const dy = point[1] - previous[1];
    path += `l${dx}${dy < 0 ? "" : " "}${dy}`;
    previous = point;
  }
  return `${path}z`;
}

const require = createRequire(import.meta.url);
const topology = JSON.parse(
  readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"),
) as Topology<{ countries: GeometryCollection<{ name: string }> }>;

const african = topology.objects.countries.geometries.filter(
  (geometry) =>
    (geometry.id !== undefined && AFRICAN_IDS.has(String(geometry.id))) ||
    geometry.properties?.name === "Somaliland",
);
if (african.length !== AFRICAN_IDS.size + 1) {
  throw new Error(`${african.length} pays trouvés, ${AFRICAN_IDS.size + 1} attendus`);
}

const merged = merge(topology, african) as MultiPolygon;
const areas = merged.coordinates.map((polygon) =>
  geoArea({ type: "Polygon", coordinates: polygon }),
);
const largest = Math.max(...areas);
const continent: MultiPolygon = {
  type: "MultiPolygon",
  // Les trous (lacs fermés) sont écartés : le fond montre la silhouette seule.
  coordinates: merged.coordinates
    .filter((_, index) => areas[index]! >= largest * MIN_AREA_SHARE)
    .map((polygon) => [polygon[0]!]),
};

const projection = geoMercator().fitWidth(WIDTH, continent);
const project = (position: Position): Point => projection(position as [number, number])!;
const rings = continent.coordinates.map((polygon) => simplify(polygon[0]!.map(project), TOLERANCE));
const height = Math.ceil(Math.max(...rings.flat().map(([, y]) => y)));
const path = rings.map(ringToPath).join("");

function placeList(
  places: ReadonlyArray<{ id: string; name: string; position: readonly number[] }>,
) {
  return places.map(({ id, name, position }) => {
    const [x, y] = project(position as Position);
    return `  { id: "${id}", name: "${name}", x: ${x.toFixed(1)}, y: ${y.toFixed(1)} },`;
  });
}

const source = `// Fichier généré par scripts/build-africa-outline.ts, ne pas modifier à la main.
// Contour de l'Afrique tiré de Natural Earth (domaine public) par world-atlas
// 2.0.2 (countries-50m, ISC), pays fusionnés, projection de Mercator.
// Voir THIRD_PARTY_LICENSES.md.

export const AFRICA_OUTLINE_WIDTH = ${WIDTH};
export const AFRICA_OUTLINE_HEIGHT = ${height};

export const AFRICA_OUTLINE_PATH =
  "${path}";

export interface AfricaPlace {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Capitales du réseau, placées dans la même projection, en unités de la boîte. */
export const AFRICA_CAPITALS: readonly AfricaPlace[] = [
${placeList(CAPITALS).join("\n")}
];

/** Autres grandes villes, sans liaison. */
export const AFRICA_CITIES: readonly AfricaPlace[] = [
${placeList(CITIES).join("\n")}
];
`;

const bytes = Buffer.byteLength(source);
if (bytes > MAX_BYTES) throw new Error(`${bytes} octets, plus que ${MAX_BYTES}`);
writeFileSync(OUTPUT, source);
console.log(`${OUTPUT} : ${rings.length} anneaux, ${rings.flat().length} points, ${bytes} octets`);
