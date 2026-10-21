const compactFormatter = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return compactFormatter.format(value);
}
