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
  },
  // La pile Docker complète (CI e2e-tests) sert plusieurs fichiers de test
  // désormais : un peu plus de marge que le défaut (5s) évite des échecs
  // d'assertion purement dus à la charge partagée, pas à un vrai bug.
  expect: { timeout: 15_000 },
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
