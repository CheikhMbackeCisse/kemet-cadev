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

test("une adresse inconnue affiche Page introuvable", async ({ page }) => {
  await page.goto("/nulle-part");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
});

// Contre l'image de production seulement : en local, `pnpm dev` sert ces pages.
for (const pathname of ["/statut", "/dev/ui", "/dev/ui/shell"]) {
  test(`${pathname} est introuvable en production`, async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, "serveur de développement");
    await page.goto(pathname);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expect(page.getByText("Kemet arrive.")).toHaveCount(0);
  });
}
