import { describe, expect, it } from "vitest";
import { parseByteRange } from "./byte-range.js";

describe("parseByteRange", () => {
  it("lit une plage complète, ouverte ou de fin", () => {
    expect(parseByteRange("bytes=0-499", 1000)).toEqual({ start: 0, end: 499 });
    expect(parseByteRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseByteRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 });
  });

  it("borne la fin à la taille du fichier", () => {
    expect(parseByteRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=-5000", 1000)).toEqual({ start: 0, end: 999 });
  });

  it("refuse une plage hors du fichier", () => {
    expect(parseByteRange("bytes=1000-", 1000)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=600-500", 1000)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 1000)).toBe("unsatisfiable");
  });

  it("ignore un en-tête absent, à plusieurs plages ou d'une autre unité", () => {
    expect(parseByteRange(undefined, 1000)).toBeNull();
    expect(parseByteRange("bytes=0-1,5-6", 1000)).toBeNull();
    expect(parseByteRange("items=0-1", 1000)).toBeNull();
    expect(parseByteRange("bytes=-", 1000)).toBeNull();
  });
});
