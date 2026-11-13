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
  // Sous la charge du runner CI (pile Docker complète, un seul worker), un
  // texte attendu après un envoi réussi a déjà mis plus de 15 s à
  // apparaître, sur des tests différents d'une exécution à l'autre.
  expect: { timeout: 30_000 },
  // Même cause (CPU limité du runner, émulation mobile). Une seule nouvelle
  // tentative : chacune coûte des minutes d'Actions. En local, un échec
  // n'est jamais rejoué.
  retries: process.env.CI ? 1 : 0,
  // Chromium seul : "Desktop Chrome" et "Pixel 7" sont deux appareils du
  // même navigateur, un seul binaire à installer et à garder en cache.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
