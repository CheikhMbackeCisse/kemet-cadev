export interface ImageSize {
  width: number;
  height: number;
}

function u16be(data: Uint8Array, offset: number): number {
  return (data[offset]! << 8) | data[offset + 1]!;
}

function u16le(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8);
}

function u24le(data: Uint8Array, offset: number): number {
  return data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16);
}

function u32be(data: Uint8Array, offset: number): number {
  return ((data[offset]! << 24) >>> 0) + (data[offset + 1]! << 16) + (data[offset + 2]! << 8) + data[offset + 3]!;
}

function ascii(data: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...data.subarray(offset, offset + length));
}

function png(data: Uint8Array): ImageSize | null {
  if (data.length < 24 || ascii(data, 12, 4) !== "IHDR") return null;
  return { width: u32be(data, 16), height: u32be(data, 20) };
}

function gif(data: Uint8Array): ImageSize | null {
  if (data.length < 10) return null;
  return { width: u16le(data, 6), height: u16le(data, 8) };
}

// Marqueurs SOF qui portent les dimensions (hors DHT, JPG et DAC).
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(data: Uint8Array): ImageSize | null {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1]!;
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (JPEG_SOF.has(marker)) return { height: u16be(data, offset + 5), width: u16be(data, offset + 7) };
    if (marker === 0xd9 || marker === 0xda) return null;
    offset += 2 + u16be(data, offset + 2);
  }
  return null;
}

function webp(data: Uint8Array): ImageSize | null {
  if (data.length < 30 || ascii(data, 8, 4) !== "WEBP") return null;
  const chunk = ascii(data, 12, 4);
  if (chunk === "VP8X") return { width: u24le(data, 24) + 1, height: u24le(data, 27) + 1 };
  if (chunk === "VP8 ") return { width: u16le(data, 26) & 0x3fff, height: u16le(data, 28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = data[21]! | (data[22]! << 8) | (data[23]! << 16) | (data[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * Largeur et hauteur d'une image PNG, JPEG, GIF ou WebP, lues dans son
 * en-tête sans la décoder. `null` si l'en-tête est illisible ou les
 * dimensions nulles.
 */
export function readImageSize(data: Uint8Array, mimeType: string): ImageSize | null {
  const size =
    mimeType === "image/png"
      ? png(data)
      : mimeType === "image/jpeg"
        ? jpeg(data)
        : mimeType === "image/gif"
          ? gif(data)
          : mimeType === "image/webp"
            ? webp(data)
            : null;
  if (!size || size.width <= 0 || size.height <= 0) return null;
  return size;
}
