import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Le pool est créé à l'appel plutôt qu'au chargement du module : les tests
 * unitaires qui importent ce package ne doivent pas exiger une base vivante.
 * Le schéma est attaché à l'instance pour l'API relationnelle de drizzle
 * (`db.query.*`) et pour l'adaptateur Drizzle de Better Auth.
 */
export function createDb(databaseUrl: string) {
  const queryClient = postgres(databaseUrl);
  return drizzle(queryClient, { schema });
}

export type Db = ReturnType<typeof createDb>;
