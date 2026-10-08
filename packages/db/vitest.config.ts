import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Les tests d'intégration partagent une seule base Postgres et la
    // remettent à zéro (resetTestDatabase) avant chacun : exécuter les
    // fichiers de test en parallèle ferait qu'un fichier efface le schéma
    // en cours d'utilisation par un autre.
    fileParallelism: false,
  },
});
