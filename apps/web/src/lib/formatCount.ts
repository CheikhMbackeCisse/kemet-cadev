/** Un nombre court, à la française : 869, 1,2k, 11,2k, 3,4M. */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  const [divisor, suffix] = value < 1_000_000 ? [1000, "k"] : [1_000_000, "M"];
  // Arrondi vers le bas : 11 290 s'affiche 11,2k, jamais un chiffre plus haut que le vrai.
  const rounded = Math.floor((value / divisor) * 10) / 10;
  return `${rounded.toFixed(1).replace(/\.0$/, "").replace(".", ",")}${suffix}`;
}
