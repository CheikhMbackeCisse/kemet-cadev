import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Le pool est créé à l'appel plutôt qu'au chargement du module : les tests
 * unitaires qui importent ce package ne doivent pas exiger une base vivante.
 */
export function createDb(databaseUrl: string) {
  const queryClient = postgres(databaseUrl);
  return drizzle(queryClient);
}

export type Db = ReturnType<typeof createDb>;
