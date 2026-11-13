import { expect, test, type Page } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn } from "./support/accounts.js";
import { createPublicSpace } from "./support/spaces.js";

// Sur téléphone, le champ n'existe qu'une fois la loupe touchée ; sur bureau,
// il est en tête du panneau Salons.
async function openSearch(page: Page) {
  if (test.info().project.name === "mobile") {
    await page.getByRole("button", { name: "Rechercher" }).click();
  }
  const field = page.getByRole("searchbox").filter({ visible: true }).first();
  await expect(field).toBeVisible();
  return field;
}

test("trouve un espace public et le rejoint, puis écrit à une personne trouvée", async ({
  page,
  playwright,
  baseURL,
}) => {
  const stamp = `${test.info().project.name}${Date.now()}`;
  const ownerHandle = `e2eowner${stamp}`;
  const seekerHandle = `e2eseek${stamp}`;
  const spaceName = `Recherche ${stamp}`;

  const owner = await playwright.request.newContext({ baseURL });
  await signUpVerifyAndSignIn(owner, `e2e-owner-${stamp}@test.kemet`, ownerHandle);
  await createPublicSpace(owner, spaceName, `recherche-${stamp}`);
  await owner.dispose();

  const seekerEmail = `e2e-seek-${stamp}@test.kemet`;
  await signUpVerifyAndSignIn(page.request, seekerEmail, seekerHandle);
  await signInBrowser(page, seekerEmail);

  await page.goto("/salons");
  let field = await openSearch(page);
  await field.fill(stamp);

  const spaces = page.getByRole("region", { name: "Espaces" });
  await expect(spaces.getByText(spaceName)).toBeVisible();
  await spaces.getByRole("button", { name: `Rejoindre ${spaceName}` }).click();
  await expect(
    page.getByRole("heading", { name: spaceName }).filter({ visible: true }).first(),
  ).toBeVisible();

  field = await openSearch(page);
  await field.fill(ownerHandle);
  const people = page.getByRole("region", { name: "Personnes" });
  await people.getByRole("button", { name: `Écrire à ${ownerHandle}` }).click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+$/);
});

test("un visiteur ne cherche que des espaces, et Échap referme la barre sur téléphone", async ({
  page,
}) => {
  await page.goto("/salons");
  const field = await openSearch(page);
  await field.fill("cadev");
  await expect(page.getByRole("region", { name: "Espaces" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Personnes" })).toHaveCount(0);

  if (test.info().project.name === "mobile") {
    await field.fill("");
    await field.press("Escape");
    await expect(page.getByRole("searchbox").filter({ visible: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rechercher" })).toBeFocused();
  }
});
