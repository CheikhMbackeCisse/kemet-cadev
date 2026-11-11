import { describe, expect, it } from "vitest";
import { spaceTints } from "./SpaceIcon.js";

describe("spaceTints", () => {
  it("donne des teintes différentes à deux espaces de même icône", () => {
    const tints = spaceTints([
      { id: "a", name: "DevOps Dakar" },
      { id: "b", name: "Cloud et infra" },
      { id: "c", name: "Design produit" },
      { id: "d", name: "UX Afrique" },
    ]);
    expect(tints.get("a")).not.toBe(tints.get("b"));
    expect(tints.get("c")).not.toBe(tints.get("d"));
  });

  it("garde des teintes entre 1 et 6 et la même pour une même liste", () => {
    const spaces = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      name: `Backend ${index}`,
    }));
    const first = spaceTints(spaces);
    const second = spaceTints(spaces);
    for (const space of spaces) {
      const tint = first.get(space.id);
      expect(tint).toBeGreaterThanOrEqual(1);
      expect(tint).toBeLessThanOrEqual(6);
      expect(second.get(space.id)).toBe(tint);
    }
    expect(new Set(spaces.slice(0, 6).map((space) => first.get(space.id))).size).toBe(6);
  });
});
