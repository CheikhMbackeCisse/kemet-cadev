import { z } from "zod";

// z.string().url() accepte javascript:, data: et vbscript: comme URL valides :
// une URL stockée puis rendue dans un <a href> doit restreindre le schéma,
// pas seulement vérifier qu'elle est syntaxiquement une URL.
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function httpUrlSchema(maxLength: number) {
  return z.string().max(maxLength).refine(isHttpUrl, "Lien http ou https uniquement.");
}
