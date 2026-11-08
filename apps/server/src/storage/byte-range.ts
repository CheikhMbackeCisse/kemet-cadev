import type { ByteRange } from "./file-storage.js";

/**
 * Lit un en-tête `Range` d'une seule plage (`bytes=0-499`, `bytes=500-`,
 * `bytes=-500`), ce que demandent les lecteurs vidéo des navigateurs.
 * `null` : en-tête absent ou ignoré (plusieurs plages, autre unité), le
 * fichier part en entier. `"unsatisfiable"` : plage hors du fichier, 416.
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart = "", rawEnd = ""] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (size === 0) return "unsatisfiable";

  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || end < start) return "unsatisfiable";
  return { start, end };
}
