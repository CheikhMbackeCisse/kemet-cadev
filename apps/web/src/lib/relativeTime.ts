const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Date courte et relative pour une ligne de fil : "à l'instant", "il y a
 * 5 min", "il y a 3 h", "hier", "il y a 4 j", puis la date du jour au-delà
 * d'une semaine. Une date future (horloge en avance) vaut "à l'instant".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "à l'instant";
  if (elapsed < HOUR) return `il y a ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `il y a ${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 2 * DAY) return "hier";
  if (elapsed < 7 * DAY) return `il y a ${Math.floor(elapsed / DAY)} j`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Date et heure complètes, pour l'infobulle et le lecteur d'écran. */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}
