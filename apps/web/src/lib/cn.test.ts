import { describe, expect, it } from "vitest";
import { cn } from "./cn.js";

describe("cn", () => {
  it("remplace un rayon du thème par un autre au lieu de les garder tous les deux", () => {
    expect(cn("rounded-control border", "rounded-card")).toBe("border rounded-card");
  });
});
