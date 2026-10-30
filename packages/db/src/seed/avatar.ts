// Avatar abstrait généré à partir du handle, jamais une photo, en data URI
// pour ne dépendre d'aucun fichier statique.

function hashSeed(handle: string): number {
  let h = 2166136261;
  for (let i = 0; i < handle.length; i += 1) {
    h ^= handle.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

// Variations autour du bleu de marque (#1265DD, DESIGN.md) et de quelques
// teintes complémentaires, jamais les couleurs d'un autre produit.
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#1265DD", "#5FA0F2"],
  ["#0F7A5C", "#56C596"],
  ["#B3450A", "#F2A65A"],
  ["#7D3FD1", "#C4A6F0"],
  ["#C4320A", "#F2906B"],
  ["#0A7FA0", "#6FD3E8"],
  ["#A3710A", "#F2C568"],
  ["#2A6B1E", "#8FD16B"],
  ["#A3157A", "#F08FCB"],
  ["#375299", "#9BB8EE"],
];

export function avatarDataUri(handle: string): string {
  const seed = hashSeed(handle);
  const rand = mulberry32(seed);
  const [base, accent] = PALETTE[seed % PALETTE.length]!;
  const shapes: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const cx = Math.round(16 + rand() * 32);
    const cy = Math.round(16 + rand() * 32);
    const r = Math.round(14 + rand() * 16);
    const opacity = (0.35 + rand() * 0.25).toFixed(2);
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="${opacity}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${base}"/>${shapes.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
