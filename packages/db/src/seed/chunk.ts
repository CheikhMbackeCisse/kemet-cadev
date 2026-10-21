// Découpe un insert en lots : certains lots de seed/community.ts dépassent
// largement la limite de paramètres d'une seule requête SQL (65535).
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
