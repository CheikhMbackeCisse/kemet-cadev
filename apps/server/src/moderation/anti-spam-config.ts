export interface AntiSpamConfig {
  newAccountWindowHours: number;
  newAccountFactor: number;
  /** Multiplie la limite d'une requête sans session, comptée par adresse IP. */
  anonymousIpFactor: number;
}

const DEFAULT_NEW_ACCOUNT_WINDOW_HOURS = 24;
const DEFAULT_NEW_ACCOUNT_FACTOR = 0.25;
const DEFAULT_ANONYMOUS_IP_FACTOR = 3;
// Au-delà, une erreur de réglage reviendrait à lever toute limite sans session.
const MAX_ANONYMOUS_IP_FACTOR = 10;

// docker-compose transmet une chaîne vide pour une variable non définie.
function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadAntiSpamConfig(env: NodeJS.ProcessEnv = process.env): AntiSpamConfig {
  return {
    newAccountWindowHours: readPositiveNumber(
      env.ANTI_SPAM_NEW_ACCOUNT_WINDOW_HOURS,
      DEFAULT_NEW_ACCOUNT_WINDOW_HOURS,
    ),
    newAccountFactor: readPositiveNumber(env.ANTI_SPAM_NEW_ACCOUNT_FACTOR, DEFAULT_NEW_ACCOUNT_FACTOR),
    anonymousIpFactor: Math.min(
      readPositiveNumber(env.RATE_LIMIT_ANONYMOUS_IP_FACTOR, DEFAULT_ANONYMOUS_IP_FACTOR),
      MAX_ANONYMOUS_IP_FACTOR,
    ),
  };
}
