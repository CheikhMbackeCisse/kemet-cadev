import { expect, test } from "@playwright/test";

test("un visiteur lit les projets et les compétitions sans erreur", async ({ page }) => {
  await page.goto("/projets");
  await expect(page.getByRole("heading", { name: "Projets" })).toBeVisible();
  await expect(page.getByText("Impossible de charger les projets.")).toHaveCount(0);

  await page.goto("/competitions");
  await expect(page.getByRole("heading", { name: "Compétitions" })).toBeVisible();
  await expect(page.getByText("Impossible de charger les compétitions.")).toHaveCount(0);
});

test("publier un projet en visiteur mène à l'inscription", async ({ page }) => {
  await page.goto("/projets");
  await page.getByRole("link", { name: "Publier" }).first().click();
  await expect(page).toHaveURL(/\/inscription$/);
});
