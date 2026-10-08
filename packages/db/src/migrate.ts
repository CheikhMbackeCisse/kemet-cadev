import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

// Clé arbitraire mais stable : sérialise les migrations si plusieurs
// processus démarrent en même temps (api, realtime, worker démarrent tous
// trois dès que Postgres est sain, voir infra/docker-compose.yml).
const MIGRATION_LOCK_KEY = 72026;

/**
 * Applique les migrations en attente avant que le service n'écoute. Sûr à
 * appeler depuis plusieurs processus au démarrage : un verrou consultatif
 * Postgres sérialise les tentatives concurrentes.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    await client.unsafe(`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client.unsafe(`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
    }
  } finally {
    await client.end();
  }
}
