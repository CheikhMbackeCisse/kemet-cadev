import { expect, test } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

test("une première visite ouvre l'accueil, Explorer sans compte mène au fil", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/decouvrir$/);
  await expect(page.getByRole("heading", { name: "Bienvenue chez les développeurs africains" })).toBeVisible();

  await page.getByRole("link", { name: "Explorer sans compte" }).click();
  await expect(page).toHaveURL(/\/fil$/);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fil" })).toBeVisible();
});

test("les quatre questions mènent à l'inscription, Passer compris", async ({ page }) => {
  await page.goto("/decouvrir");
  await page.getByRole("link", { name: "Commencer" }).click();

  await expect(page.getByText("Étape 1 sur 4")).toBeVisible();
  await page.getByText("Développeur/se", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "Tes domaines" })).toBeVisible();
  await page.getByText("Paiement", { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "Ta nationalité" })).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();

  await expect(page.getByRole("heading", { name: "Que viens-tu faire sur Kemet ?" })).toBeVisible();
  await page.getByText("Aider les autres", { exact: true }).click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/inscription$/);
  const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("kemet.intro") ?? "{}"));
  expect(stored).toMatchObject({ seen: true, answers: { role: "developer", interests: ["payments"], intents: ["help_others"] } });
});

test("les réponses de l'accueil rejoignent le profil après l'inscription", async ({ page }, testInfo) => {
  const handle = uniqueHandle("e2eintro", testInfo.project.name);
  const email = `${handle}@test.kemet`;
  await page.addInitScript(() => {
    if (window.localStorage.getItem("kemet.intro")) return;
    window.localStorage.setItem(
      "kemet.intro",
      JSON.stringify({ seen: true, savedAt: Date.now(), answers: { role: "student", interests: ["ai"], intents: ["learn"] } }),
    );
  });
  await signUpVerifyAndSignIn(page.request, email, handle);
  await page.goto("/bienvenue");

  await expect(page.getByRole("heading", { name: "Dans quel pays es-tu ?" })).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();
  await expect(page.getByRole("heading", { name: "Quelle est ta spécialité ?" })).toBeVisible();

  const me = await (await page.request.get("/api/me")).json();
  expect(me.profile.role).toBe("student");
  expect(me.onboarding).toMatchObject({ interests: ["ai"], intents: ["learn"] });
});

test("un compte existant qui se connecte ne voit jamais l'accueil", async ({ page, request }, testInfo) => {
  const handle = uniqueHandle("e2eintroexist", testInfo.project.name);
  const email = `${handle}@test.kemet`;
  await signUpVerifyAndSignIn(request, email, handle);
  await request.patch("/api/me/onboarding", { data: { completed: true } });

  await signInBrowser(page, email);
  await page.goto("/");
  await expect(page).not.toHaveURL(/decouvrir/);
  await page.request.post("/api/auth/sign-out", { data: {} });
  await page.goto("/");
  await expect(page).not.toHaveURL(/decouvrir/);
});
