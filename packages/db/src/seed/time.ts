const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR_MS);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}
