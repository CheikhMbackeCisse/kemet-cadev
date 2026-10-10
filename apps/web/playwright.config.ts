import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm dev",
        port: 5173,
        reuseExistingServer: true,
      },
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // La pile Docker complète (CI e2e-tests) sert plusieurs fichiers de test
  // désormais : un peu plus de marge que le défaut (5s) évite des échecs
  // d'assertion purement dus à la charge partagée, pas à un vrai bug.
  // Relevé à nouveau au lot 6 (15s → 30s) : preuves dans
  // les corrections faites après la CI :
  // trois exécutions CI consécutives ont chacune vu un test différent
  // (attachments, puis assistant, puis le plus simple, chat) échouer une
  // fois sur l'attente du texte qui suit un envoi, toujours après une
  // réponse serveur réussie et rapide (jamais d'erreur HTTP dans les
  // journaux), et toujours réussir au nouvel essai ou lors d'une
  // exécution suivante sans aucun changement de code. Deux fichiers de
  // test en plus dans la même suite à un seul worker allongent son temps
  // total, ce qui use la marge déjà posée au lot 5 bis sous la charge
  // partagée et variable du runner CI, sans rapport avec le lot qui a
  // ajouté ces fichiers.
  expect: { timeout: 30_000 },
  // Un essai isolé reste parfois trop lent sous la charge partagée de la
  // pile Docker complète (CPU limité du runner CI, émulation mobile) même
  // après correction des causes déterministes trouvées au lot 5 bis : voir
  // Les essais locaux restent à zéro.
  retries: process.env.CI ? 2 : 0,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
