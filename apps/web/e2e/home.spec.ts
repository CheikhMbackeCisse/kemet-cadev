import { expect, test } from "@playwright/test";
import { skipIntro } from "./support/intro.js";
import { expectVisitorInvitation } from "./support/visitor.js";

test("la racine ouvre le fil pour un visiteur qui a déjà vu l'accueil", async ({ page, isMobile }) => {
  await skipIntro(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fil" })).toBeVisible();
  await expectVisitorInvitation(page, isMobile);
});

test("la page de connexion affiche les options pour un visiteur", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await expect(page.getByText("Créer un compte").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Politique de confidentialité" })).toBeVisible();
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

for (const pathname of ["/inscription", "/connexion"]) {
  test(`${pathname} tient dans l'écran sans défilement`, async ({ page }) => {
    await page.goto(pathname);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight - window.innerHeight,
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(overflow).toEqual({ vertical: 0, horizontal: 0 });
  });
}
