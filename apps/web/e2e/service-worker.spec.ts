import { expect, test } from "@playwright/test";

// Le service worker n'existe que dans la version construite (pile Docker de
// la CI, production) : le serveur de développement Vite ne l'enregistre pas.
test.skip(!process.env.PLAYWRIGHT_BASE_URL, "service worker absent du serveur de développement");

test(
  "une navigation vers l'api atteint le serveur même sous le service worker",
  { tag: "@prod-smoke" },
  async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Le service worker ne contrôle la page qu'à partir du chargement suivant.
    await page.reload();
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    // Même chemin qu'un retour de Google ou de GitHub sur
    // /api/auth/callback/<fournisseur> : une navigation de premier niveau.
    const response = await page.goto("/api/health");
    expect(response?.headers()["content-type"]).toContain("application/json");
    await expect(page.locator("body")).toContainText('"status":"ok"');
  },
);
