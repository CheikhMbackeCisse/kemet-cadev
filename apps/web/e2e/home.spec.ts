import { expect, test } from "@playwright/test";

test("la racine ouvre le fil, y compris pour un visiteur", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fil" })).toBeVisible();
  await expect(page.getByText("Tu consultes Kemet sans compte.")).toBeVisible();
});

test("la page de connexion affiche les options pour un visiteur", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByText("Créer un compte").first()).toBeVisible();
  await expect(page.getByText("Parcourir les espaces")).toBeVisible();
});

test("la page de statut affiche l'état des services", async ({ page }) => {
  await page.goto("/statut");
  await expect(page.getByText("Kemet arrive.")).toBeVisible();
});
