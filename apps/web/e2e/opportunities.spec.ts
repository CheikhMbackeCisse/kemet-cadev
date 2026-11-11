import { expect, test } from "@playwright/test";
import { signInBrowser, signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";
import { skipIntro } from "./support/intro.js";

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.beforeEach(async ({ page }) => {
  await skipIntro(page);
});

test("publie un stage depuis le formulaire et le retrouve dans Opportunités", async ({ page, request }) => {
  const handle = uniqueHandle("e2eoff", test.info().project.name);
  const email = `${handle}@test.kemet`;
  const title = `Stage web ${handle}`;
  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/fil?onglet=opportunites");
  await page.getByRole("link", { name: "Publier une offre" }).click();
  await expect(page.getByRole("heading", { name: "Publier une offre" })).toBeVisible();

  await page.getByRole("combobox", { name: "Type d'offre" }).click();
  await page.getByRole("option", { name: "Stage" }).click();
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Organisation").fill("Studio de test");
  await page.getByText("Poste ou mission à distance").click();
  await page.getByText("Web", { exact: true }).click();
  await page.getByLabel("Description").fill("Six mois sur un vrai projet client, avec une relecture de code chaque jour.");
  await page.getByLabel("Date de début").fill(isoDateInDays(30));
  await page.getByRole("button", { name: "Publier", exact: true }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("C'est ton offre.")).toBeVisible();

  await page.goto("/fil?onglet=opportunites");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("postuler ouvre une conversation avec l'auteur, brouillon prérempli et rien d'envoyé", async ({
  page,
  request,
  playwright,
}) => {
  const authorHandle = uniqueHandle("e2eaut", test.info().project.name);
  const candidateHandle = uniqueHandle("e2ecan", test.info().project.name);
  const slug = `offre-${authorHandle}`;
  const title = `Emploi backend ${authorHandle}`;

  const authorRequest = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  await signUpVerifyAndSignIn(authorRequest, `${authorHandle}@test.kemet`, authorHandle);
  const published = await authorRequest.post("/api/opportunities", {
    data: {
      slug,
      kind: "job",
      title,
      organization: "Organisation de test",
      remote: false,
      countryCode: "SN",
      city: "Dakar",
      domains: ["backend"],
      description: "Reprendre une API Node.js en production et ses tests de bout en bout.",
      contractType: "cdi",
      startDate: isoDateInDays(30),
      compensationFcfa: 900000,
      budgetMinFcfa: null,
      budgetMaxFcfa: null,
      deadline: null,
      criteria: [],
    },
  });
  expect(published.ok(), `POST /api/opportunities : ${published.status()}`).toBe(true);
  await authorRequest.dispose();

  await page.goto(`/opportunites/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer un compte pour postuler" })).toBeVisible();

  await signUpVerifyAndSignIn(request, `${candidateHandle}@test.kemet`, candidateHandle);
  await signInBrowser(page, `${candidateHandle}@test.kemet`);
  await page.reload();
  await page.getByRole("button", { name: "Postuler" }).click();

  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+/);
  const composer = page.getByRole("textbox").last();
  await expect(composer).toHaveValue(new RegExp(`votre offre « ${title} » m'intéresse`));
  await expect(composer).toHaveValue(new RegExp(`/u/${candidateHandle}`));
});
