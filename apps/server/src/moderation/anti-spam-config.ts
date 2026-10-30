export interface AntiSpamConfig {
  newAccountWindowHours: number;
  newAccountFactor: number;
}

const DEFAULT_NEW_ACCOUNT_WINDOW_HOURS = 24;
const DEFAULT_NEW_ACCOUNT_FACTOR = 0.25;

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
  };
}
