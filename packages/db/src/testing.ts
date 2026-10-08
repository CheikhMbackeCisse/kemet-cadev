import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));

let warned = false;

/**
 * Renvoie `DATABASE_URL_TEST` ou `null` si elle n'est pas définie, en
 * avertissant une seule fois pourquoi les tests d'intégration sont ignorés.
 */
export function getTestDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL_TEST;
  if (!url && !warned) {
    warned = true;
    console.warn(
      "DATABASE_URL_TEST non définie : tests d'intégration ignorés. " +
        "Démarrez une base Postgres locale et renseignez la variable pour les exécuter.",
    );
  }
  return url ?? null;
}

/**
 * Remet la base de test à zéro et applique les migrations SQL générées par
 * drizzle-kit, dans l'ordre de leur nom de fichier. Utilisé par les tests
 * d'intégration de ce paquet et de `apps/server`, jamais en production.
 */
export async function resetTestDatabase(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  try {
    await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const sql = readFileSync(`${migrationsDir}/${file}`, "utf-8");
      await client.unsafe(sql);
    }
  } finally {
    await client.end();
  }
}
