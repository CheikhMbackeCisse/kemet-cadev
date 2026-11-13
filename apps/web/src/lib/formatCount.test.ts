import { describe, expect, it } from "vitest";
import { formatCount } from "./formatCount.js";

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [869, "869"],
    [999, "999"],
    [1000, "1k"],
    [1250, "1,2k"],
    [11_290, "11,2k"],
    [999_999, "999,9k"],
    [3_400_000, "3,4M"],
  ])("%d s'écrit %s", (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });
});
