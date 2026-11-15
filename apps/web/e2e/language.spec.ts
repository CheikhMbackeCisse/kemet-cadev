import { expect, test } from "@playwright/test";

test("le français par défaut, l'anglais par le choix FR / EN de l'accueil", async ({ page }) => {
  await page.goto("/decouvrir");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("link", { name: "Commencer" }).first()).toBeVisible();

  await page.getByRole("link", { name: "English" }).first().click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Welcome to the home of African developers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore without an account" })).toBeVisible();

  await page.getByRole("button", { name: "Français" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("link", { name: "Commencer" }).first()).toBeVisible();
});
