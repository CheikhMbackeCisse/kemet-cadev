import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";

// Image de démonstration générée plutôt que livrée en binaire. Encodeur PNG
// écrit à la main : les bibliothèques d'image courantes dépendent de sharp,
// dont les binaires libvips sont sous LGPL.

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** PNG RGB 8 bits, sans filtrage par ligne (octet de filtre 0). */
function encodePng(width: number, height: number, pixels: Buffer): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // couleur vraie RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bleu de marque et fonds sombres de DESIGN.md. Volontairement peu
// contraste : l'image accompagne un post, elle ne doit pas crier plus fort
// que le texte a cote.
const BASE: readonly [number, number, number] = [0x14, 0x1b, 0x2a];

const ACCENTS: ReadonlyArray<readonly [number, number, number]> = [
  [0x12, 0x65, 0xdd],
  [0x1f, 0x6f, 0xe5],
  [0x0f, 0x7a, 0x5c],
  [0x1b, 0x24, 0x36],
  [0x26, 0x30, 0x49],
];

/** Damier sobre et deterministe : lisible en vignette comme en grand. */
function drawPattern(width: number, height: number, seed: number): Buffer {
  const random = mulberry32(seed);
  const cell = 60;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const colors: (readonly [number, number, number])[] = [];
  for (let i = 0; i < cols * rows; i += 1) {
    // Une case sur trois environ porte un accent, le reste reste au fond.
    colors.push(random() < 0.34 ? ACCENTS[Math.floor(random() * ACCENTS.length)]! : BASE);
  }

  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = Math.floor(y / cell) * cols + Math.floor(x / cell);
      const [r, g, b] = colors[index]!;
      const offset = (y * width + x) * 3;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
    }
  }
  return pixels;
}

export interface SeededImage {
  storageKey: string;
  mimeType: string;
  originalName: string;
  byteSize: number;
}

/**
 * Écrit une image de démonstration dans `UPLOADS_DIR` et renvoie de quoi créer
 * la ligne `post_attachments` correspondante. La clé de stockage est un UUID,
 * comme celles que pose le serveur.
 */
export async function writeSeedPostImage(
  uploadsDir: string,
  seedText: string,
  originalName: string,
): Promise<SeededImage> {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  const width = 960;
  const height = 540;
  const png = encodePng(width, height, drawPattern(width, height, seed >>> 0));

  const storageKey = randomUUID();
  const path = join(uploadsDir, storageKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);

  return {
    storageKey,
    mimeType: "image/png",
    originalName,
    byteSize: png.byteLength,
  };
}
