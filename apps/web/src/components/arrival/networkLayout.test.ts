import { describe, expect, it } from "vitest";
import {
  AFRICA_CAPITALS,
  AFRICA_CITIES,
  AFRICA_OUTLINE_HEIGHT,
  AFRICA_OUTLINE_WIDTH,
} from "./africaOutline.js";
import { NETWORK_ARCS, NETWORK_LINKS, glowTurn } from "./networkLayout.js";

function degrees() {
  const count = new Map(AFRICA_CAPITALS.map((capital) => [capital.id, 0]));
  for (const [from, to] of NETWORK_LINKS) {
    count.set(from, count.get(from)! + 1);
    count.set(to, count.get(to)! + 1);
  }
  return count;
}

describe("réseau des capitales de l'accueil", () => {
  it("relie chaque capitale à deux ou trois autres, jamais deux fois à la même", () => {
    for (const [id, degree] of degrees()) {
      expect(degree, id).toBeGreaterThanOrEqual(2);
      expect(degree, id).toBeLessThanOrEqual(3);
    }
    const pairs = NETWORK_LINKS.map(([from, to]) => [from, to].sort().join("-"));
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("forme un seul réseau, d'un bout à l'autre du continent", () => {
    const reached = new Set(["dakar"]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [from, to] of NETWORK_LINKS) {
        if (reached.has(from) !== reached.has(to)) {
          reached.add(from);
          reached.add(to);
          grew = true;
        }
      }
    }
    expect(reached.size).toBe(AFRICA_CAPITALS.length);

    const xs = AFRICA_CAPITALS.map((capital) => capital.x / AFRICA_OUTLINE_WIDTH);
    const ys = AFRICA_CAPITALS.map((capital) => capital.y / AFRICA_OUTLINE_HEIGHT);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.75);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.8);
  });

  it("garde chaque ville sans liaison à part des capitales", () => {
    for (const city of AFRICA_CITIES) {
      for (const capital of AFRICA_CAPITALS) {
        expect(Math.hypot(city.x - capital.x, city.y - capital.y), city.id).toBeGreaterThan(12);
      }
    }
  });

  it("fait passer une lueur une fois par arc à chaque tour, dans un sens puis dans l'autre", () => {
    const turns = NETWORK_ARCS.map((_, turn) => glowTurn(turn).arc.key);
    expect(new Set(turns).size).toBe(NETWORK_ARCS.length);
    expect(glowTurn(0).reverse).toBe(false);
    expect(glowTurn(1).reverse).toBe(true);
  });
});
