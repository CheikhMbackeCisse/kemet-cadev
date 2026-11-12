import { describe, expect, it } from "vitest";
import { readImageSize } from "./image-size.js";

function bytes(...parts: (number[] | string)[]): Uint8Array {
  return Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part,
    ),
  );
}

describe("readImageSize", () => {
  it("lit un PNG", () => {
    const data = bytes(
      [0x89],
      "PNG",
      [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13],
      "IHDR",
      [0, 0, 2, 208, 0, 0, 2, 208],
    );
    expect(readImageSize(data, "image/png")).toEqual({ width: 720, height: 720 });
  });

  it("lit un JPEG après ses segments APP", () => {
    const app0 = [0xff, 0xe0, 0, 6, 0x4a, 0x46, 0x49, 0x46];
    const sof = [0xff, 0xc0, 0, 17, 8, 0x03, 0x84, 0x06, 0x40, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(readImageSize(bytes([0xff, 0xd8], app0, sof), "image/jpeg")).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("lit un GIF", () => {
    expect(readImageSize(bytes("GIF89a", [0x40, 0x01, 0xf0, 0x00]), "image/gif")).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("lit un WebP étendu", () => {
    const data = bytes(
      "RIFF",
      [0, 0, 0, 0],
      "WEBP",
      "VP8X",
      [10, 0, 0, 0, 0, 0, 0, 0],
      [0x7f, 0x02, 0],
      [0xdf, 0x01, 0],
    );
    expect(readImageSize(data, "image/webp")).toEqual({ width: 640, height: 480 });
  });

  it("refuse un en-tête tronqué ou un autre type", () => {
    expect(readImageSize(bytes([0xff, 0xd8, 0xff, 0xda]), "image/jpeg")).toBeNull();
    expect(readImageSize(bytes("GIF89a"), "image/gif")).toBeNull();
    expect(readImageSize(bytes("abc"), "application/pdf")).toBeNull();
  });

  it("refuse des dimensions qui ne décrivent aucune image réelle", () => {
    // 2^31 de large : ne tiendrait pas dans une colonne integer.
    const data = bytes(
      [0x89],
      "PNG",
      [0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13],
      "IHDR",
      [0x80, 0, 0, 0, 0, 0, 2, 208],
    );
    expect(readImageSize(data, "image/png")).toBeNull();
  });
});
