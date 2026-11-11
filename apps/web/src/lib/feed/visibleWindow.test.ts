import { describe, expect, it } from "vitest";
import { visibleWindow } from "./visibleWindow.js";

describe("visibleWindow", () => {
  it("returns null for an empty list", () => {
    expect(visibleWindow([], 0, 740, 800)).toBeNull();
  });

  it("starts at the top when nothing is scrolled", () => {
    expect(visibleWindow([200, 200, 200, 200, 200, 200, 200, 200, 200, 200], 0, 400, 200)).toEqual({
      start: 0,
      end: 3,
    });
  });

  it("covers the reading position with its margin", () => {
    const heights = Array.from({ length: 20 }, () => 100);
    expect(visibleWindow(heights, 1000, 300, 200)).toEqual({ start: 7, end: 15 });
  });

  it("uses the remembered height of each row", () => {
    expect(visibleWindow([1000, 50, 50, 50, 1000, 50], 1050, 100, 0)).toEqual({ start: 1, end: 4 });
  });

  it("keeps the last row when the position is past the end", () => {
    expect(visibleWindow([100, 100], 5000, 740, 0)).toEqual({ start: 1, end: 1 });
  });
});
