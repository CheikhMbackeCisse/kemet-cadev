import { LOCALE } from "../i18n/language.js";
import { fr } from "../i18n/fr.js";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// toLocaleString avec options crée un formateur à chaque appel, coûteux sur un
// fil de plusieurs dizaines de cartes : un seul par format, créé une fois.
const SHORT_DATE = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const FULL_DATE = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long", timeStyle: "short" });

/**
 * Date courte et relative pour une ligne de fil : "à l'instant", "il y a
 * 5 min", "il y a 3 h", "hier", "il y a 4 j", puis la date du jour au-delà
 * d'une semaine. Une date future (horloge en avance) vaut "à l'instant".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return fr.common.justNow;
  if (elapsed < HOUR) return fr.common.minutesAgo(Math.floor(elapsed / MINUTE));
  if (elapsed < DAY) return fr.common.hoursAgo(Math.floor(elapsed / HOUR));
  if (elapsed < 2 * DAY) return fr.common.yesterday;
  if (elapsed < 7 * DAY) return fr.common.daysAgo(Math.floor(elapsed / DAY));
  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? SHORT_DATE : SHORT_DATE_WITH_YEAR).format(date);
}

/** Date et heure complètes, pour l'infobulle et le lecteur d'écran. */
export function formatFullDate(iso: string): string {
  return FULL_DATE.format(new Date(iso));
}
