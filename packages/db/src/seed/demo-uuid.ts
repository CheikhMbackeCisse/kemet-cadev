import { createHash } from "node:crypto";

/**
 * UUID stable dérivé d'un nom (forme v5, SHA-1). Une ligne de démonstration
 * créée avec cet identifiant est reconnue au passage suivant du seed, qui
 * peut donc être relancé sans rien dupliquer.
 */
export function demoUuid(name: string): string {
  const bytes = createHash("sha1").update(`kemet-demo:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
