import { expect, test } from "@playwright/test";

test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "barre d'activité propre au bureau");
});

test("le panneau Salons se replie au clic et par Ctrl+B, et s'en souvient", async ({ page }) => {
  await page.goto("/salons");
  const bar = page.getByRole("navigation", { name: "Sections" });
  const toggle = bar.getByRole("button", { name: "Salons" });
  const panel = page.getByRole("complementary", { name: "Salons" });

  await expect(panel).toBeVisible();
  await expect(panel.getByRole("navigation", { name: "Espaces publics" })).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(page.getByRole("complementary", { name: "Salons" })).toBeHidden();

  await page.keyboard.press("Control+b");
  await expect(page.getByRole("complementary", { name: "Salons" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Salons" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("la barre d'activité se parcourt aux flèches, en un seul arrêt de tabulation", async ({
  page,
}) => {
  await page.goto("/skills");
  const bar = page.getByRole("navigation", { name: "Sections" });
  const skills = bar.getByRole("link", { name: "Skills" });
  await expect(skills).toHaveAttribute("aria-current", "page");

  await skills.focus();
  await page.keyboard.press("ArrowDown");
  await expect(bar.getByRole("link", { name: "Projets" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(bar.getByRole("link", { name: "Fil" })).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fil$/);
  await expect(
    page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Fil" }),
  ).toHaveAttribute("aria-current", "page");
});
