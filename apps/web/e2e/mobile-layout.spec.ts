import { expect, test, type Page } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

async function documentScrolls(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.scrollingElement!;
    return root.scrollHeight > root.clientHeight || window.scrollY !== 0;
  });
}

test("le salon tient dans l'écran mobile et garde le composeur au-dessus du clavier", async ({
  page,
  request,
}) => {
  test.skip(test.info().project.name !== "mobile", "comportement propre au mobile");

  const handle = uniqueHandle("e2evp", test.info().project.name);
  const email = `${handle}@test.kemet`;
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();

  const composer = page.getByPlaceholder("Écrire un message…");
  await composer.waitFor();
  await composer.fill(`Premier message ${handle}`);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(`Premier message ${handle}`)).toBeVisible();

  const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewportMeta).toContain("interactive-widget=resizes-content");

  // Un seul défilement : la liste des messages, jamais la page.
  const messageList = page.getByRole("log", { name: "Messages du salon" });
  await expect(messageList).toHaveCSS("overflow-y", "auto");
  expect(await documentScrolls(page)).toBe(false);

  // 16 px : en dessous, Safari iOS zoome au focus et décale la page.
  await expect(composer).toHaveCSS("font-size", "16px");

  const tabBar = page.getByRole("navigation", { name: "Navigation principale" });
  const composerBox = (await composer.boundingBox())!;
  const tabBarBox = (await tabBar.boundingBox())!;
  expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(tabBarBox.y);

  // Chromium émulé n'ouvre pas de clavier virtuel. Avec
  // interactive-widget=resizes-content, le clavier réduit la fenêtre : la
  // même réduction est simulée ici.
  await composer.focus();
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: viewport.width, height: viewport.height - 320 });

  await expect(composer).toBeFocused();
  await expect(composer).toBeInViewport({ ratio: 1 });
  const shrunkComposerBox = (await composer.boundingBox())!;
  const shrunkTabBarBox = (await tabBar.boundingBox())!;
  expect(shrunkComposerBox.y + shrunkComposerBox.height).toBeLessThanOrEqual(shrunkTabBarBox.y);
  expect(shrunkTabBarBox.y + shrunkTabBarBox.height).toBeLessThanOrEqual(viewport.height - 320);
  expect(await documentScrolls(page)).toBe(false);
});
