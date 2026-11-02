import { expect, test, type Locator, type Page } from "@playwright/test";

async function outlineOf(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
}

async function primaryColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

test("un champ montre son focus par sa bordure, sans contour autour", async ({ page }) => {
  await page.goto("/connexion");
  const email = page.getByLabel("Adresse email");
  await email.click();
  await expect(email).toBeFocused();
  expect((await outlineOf(email)).style).toBe("none");
  const borderColor = await email.evaluate((element) => getComputedStyle(element).borderTopColor);
  expect(borderColor).toBe(await primaryColor(page));
});

test("un lien atteint au clavier a un contour, pas un lien atteint à la souris", async ({ page }) => {
  await page.goto("/connexion");
  const link = page.getByRole("link", { name: "Mot de passe oublié ?" });

  const box = await link.boundingBox();
  if (!box) throw new Error("Lien introuvable à l'écran.");
  // Bouton de la souris enfoncé sans être relâché : le lien prend le focus
  // sans que la navigation parte.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(link).toBeFocused();
  expect((await outlineOf(link)).style).toBe("none");
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  expect(await outlineOf(link)).toEqual({ style: "solid", width: "2px" });
});
