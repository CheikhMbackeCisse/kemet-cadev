import { expect, test } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

test("sur mobile, l'onglet Salons liste les espaces et leurs salons, un salon s'ouvre en plein écran", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "comportement propre au mobile");
  const handle = uniqueHandle("e2enav", testInfo.project.name);
  const email = `${handle}@test.kemet`;
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/salons/nouveau");
  await page.getByLabel("Nom").fill(`Espace ${handle}`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByPlaceholder("Écrire un message…")).toBeVisible();

  await page.getByRole("button", { name: "Retour aux salons" }).click();
  await expect(page.getByRole("button", { name: `Espace ${handle}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer un espace" })).toBeVisible();
  await page.getByRole("button", { name: "mèmes" }).click();
  await expect(page.getByPlaceholder("Écrire un message…")).toBeVisible();

  // L'espace ouvert d'office est le premier de la liste, "Débuter en
  // informatique", sans salon "général" : on choisit celui du test.
  await page.goto("/salons");
  await expect(page.getByPlaceholder("Écrire un message…")).toBeHidden();
  await page.getByRole("button", { name: `Espace ${handle}` }).click();
  await expect(page.getByRole("button", { name: "général" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Écrire un message…")).toBeHidden();
});

test("la page Moi montre le profil, ce qui manque, et mène aux paramètres par son menu", async ({
  page,
  request,
}, testInfo) => {
  const handle = uniqueHandle("e2emoi", testInfo.project.name);
  const email = `${handle}@test.kemet`;
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/moi");
  await expect(page.getByText(`@${handle}`)).toBeVisible();
  await expect(page.getByText("0 points · encore 300 pour Artisan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Partager le profil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complète ton profil" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Enregistrés" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Paramètres" }).click();
  await expect(page).toHaveURL(/\/parametres$/);

  await page.getByLabel("Chercher un réglage").fill("thème");
  await page.getByRole("link", { name: /Apparence/ }).click();
  await expect(page.getByRole("heading", { name: "Apparence" })).toBeVisible();

  await page.goto("/parametres/profil");
  await page.getByLabel("Bio", { exact: true }).fill("Je construis des API de paiement.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Enregistré.", { exact: true }).first()).toBeVisible();
  const me = await (await page.request.get("/api/me")).json();
  expect(me.profile.bio).toBe("Je construis des API de paiement.");
});
