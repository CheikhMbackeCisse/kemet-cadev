import { expect, test, type Page } from "@playwright/test";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";
import { createPublicSpace } from "./support/spaces.js";

async function expectStep(page: Page, step: number, title: string) {
  await expect(page.getByRole("progressbar", { name: `Étape ${step} sur 6` })).toBeAttached();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

async function newAccount(page: Page, prefix: string, projectName: string) {
  const handle = uniqueHandle(prefix, projectName);
  await signUpVerifyAndSignIn(page.request, `${handle}@test.kemet`, handle);
  return handle;
}

test("le parcours complet enregistre chaque choix et ouvre le fil", async ({ page, request }, testInfo) => {
  // L'hôte de l'espace a sa propre session, séparée de celle du navigateur.
  const owner = uniqueHandle("e2eonbhote", testInfo.project.name);
  const spaceName = `Mobile ${owner}`;
  await signUpVerifyAndSignIn(request, `${owner}@test.kemet`, owner);
  await createPublicSpace(request, spaceName, `mobile-${owner}`, "Applications mobiles et paiement");
  await request.patch("/api/me/onboarding", { data: { completed: true } });

  const handle = await newAccount(page, "e2eonb", testInfo.project.name);
  await page.goto("/");

  await expect(page).toHaveURL(/\/bienvenue\/pays$/);
  await expectStep(page, 1, "Dans quel pays es-tu ?");
  await page.getByLabel("Chercher un pays").fill("seneg");
  await page.getByText("Sénégal", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expectStep(page, 2, "Que fais-tu ?");
  await expect(page).toHaveURL(/\/bienvenue\/role$/);
  await page.getByText("Développeur/se", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expectStep(page, 3, "Quelle est ta spécialité ?");
  await page.getByRole("textbox", { name: "Ta spécialité" }).fill("Développeuse Flutter");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expectStep(page, 4, "Quels sujets t'intéressent ?");
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await page.getByText("Mobile", { exact: true }).click();
  await page.getByText("Fintech et paiement", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expectStep(page, 5, "Rejoins des espaces");
  await page.getByRole("button", { name: `Rejoindre ${spaceName}`, pressed: false }).click();
  await expect(page.getByRole("button", { name: `Rejoindre ${spaceName}`, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expectStep(page, 6, "Suis quelques personnes");
  const follow = page.getByRole("button", { name: /^Suivre /, pressed: false }).first();
  await expect(follow).toBeVisible();
  await follow.click();
  await expect(page.getByRole("button", { name: /^Suivre /, pressed: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir le fil" }).click();

  await expect(page).toHaveURL(/\/fil$/);
  const me = await (await page.request.get("/api/me")).json();
  expect(me.profile).toMatchObject({ country: "SN", role: "developer", title: "Développeuse Flutter", handle });
  expect(me.onboarding).toMatchObject({ completed: true, interests: ["mobile", "payments"] });
});

test("un compte qui revient reprend l'écran où il s'était arrêté, Retour compris", async ({ page }, testInfo) => {
  await newAccount(page, "e2eonbrep", testInfo.project.name);
  await page.goto("/bienvenue/pays");
  await page.getByRole("button", { name: "Passer" }).click();
  await expectStep(page, 2, "Que fais-tu ?");
  await page.getByRole("button", { name: "Passer" }).click();
  await expectStep(page, 3, "Quelle est ta spécialité ?");
  await page.getByRole("button", { name: "Retour" }).click();
  await expectStep(page, 2, "Que fais-tu ?");

  await page.goto("/");
  await expect(page).toHaveURL(/\/bienvenue\/role$/);
  await expectStep(page, 2, "Que fais-tu ?");
});

test("Passer sur chaque écran termine le parcours sans rien imposer", async ({ page }, testInfo) => {
  await newAccount(page, "e2eonbpass", testInfo.project.name);
  await page.goto("/");
  for (let step = 1; step <= 6; step += 1) {
    await expect(page.getByRole("progressbar", { name: `Étape ${step} sur 6` })).toBeAttached();
    await page.getByRole("button", { name: "Passer" }).click();
  }
  await expect(page).toHaveURL(/\/fil$/);

  const me = await (await page.request.get("/api/me")).json();
  // Le pays vient de la création du compte de test, pas du parcours.
  expect(me.profile).toMatchObject({ country: "SN", role: null, title: null });
  expect(me.onboarding.completed).toBe(true);
});

test("un compte qui a terminé n'est jamais renvoyé dans l'onboarding", async ({ page }, testInfo) => {
  await newAccount(page, "e2eonbfini", testInfo.project.name);
  await page.request.patch("/api/me/onboarding", { data: { completed: true } });

  await page.goto("/");
  await expect(page).not.toHaveURL(/bienvenue/);
  await page.goto("/bienvenue/interets");
  await expect(page).toHaveURL(/\/fil$/);
  await page.goto("/ton-role");
  await expect(page).toHaveURL(/\/fil$/);
});
