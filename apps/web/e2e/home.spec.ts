import { expect, test } from "@playwright/test";

test("la page d'accueil affiche la page d'accueil visiteur", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Se connecter").first()).toBeVisible();
  await expect(page.getByText("Créer un compte").first()).toBeVisible();
});

test("la page de statut affiche l'état des services", async ({ page }) => {
  await page.goto("/statut");
  await expect(page.getByText("Kemet arrive.")).toBeVisible();
});
