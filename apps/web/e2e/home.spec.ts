import { expect, test } from "@playwright/test";

test("la page d'accueil affiche le message d'attente", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Kemet arrive.")).toBeVisible();
});
