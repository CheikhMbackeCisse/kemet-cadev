import { expect, test, type Page } from "@playwright/test";
import { signUpVerifyAndSignIn, uniqueHandle } from "./support/accounts.js";

const SPECIALTY = "Quelle est ta spécialité ?";
const COUNTRY = "Dans quel pays es-tu ?";
const ROLE = "Que fais-tu ?";
const INTERESTS = "Quels sujets t'intéressent ?";
const SPACES = "Rejoins des espaces";
const PEOPLE = "Suis quelques personnes";

interface RoleCase {
  label: string;
  role: string;
  prefix: string;
  /** Deuxième question avant l'inscription : domaines ou ce que l'on cherche. */
  second: { title: string; choice: string };
  /** Titres attendus après l'inscription, dans l'ordre. */
  onboarding: string[];
}

const ROLE_CASES: RoleCase[] = [
  {
    label: "Je code",
    role: "developer",
    prefix: "e2earrdev",
    second: { title: "Tes domaines", choice: "Mobile" },
    onboarding: ["Tu codes en freelance ou en entreprise ?", SPECIALTY, SPACES, PEOPLE],
  },
  {
    label: "J'étudie l'informatique",
    role: "student",
    prefix: "e2earrstu",
    second: { title: "Tes domaines", choice: "Mobile" },
    onboarding: ["Où étudies-tu ?", SPECIALTY, SPACES, PEOPLE],
  },
  {
    label: "Je recrute",
    role: "hr",
    prefix: "e2earrhr",
    second: { title: "Que cherches-tu ?", choice: "Recruter" },
    onboarding: ["Pour quelle entreprise recrutes-tu ?", INTERESTS, SPACES, PEOPLE],
  },
  {
    label: "Je dirige une entreprise",
    role: "entrepreneur",
    prefix: "e2earrent",
    second: { title: "Que cherches-tu ?", choice: "Trouver un partenaire" },
    onboarding: ["Quelle entreprise diriges-tu ?", INTERESTS, SPACES, PEOPLE],
  },
  {
    label: "Autre",
    role: "other",
    prefix: "e2earroth",
    second: { title: "Que cherches-tu ?", choice: "Suivre la communauté" },
    onboarding: [INTERESTS, SPACES, PEOPLE],
  },
];

async function answerIntro(page: Page, roleCase: RoleCase) {
  await page.goto("/decouvrir/qui");
  await page.getByText(roleCase.label, { exact: true }).click();
  if (roleCase.role === "other") await page.getByLabel("Précise").fill("Enseignante");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: roleCase.second.title })).toBeVisible();
  await page.getByText(roleCase.second.choice, { exact: true }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByRole("heading", { name: "Ta nationalité" })).toBeVisible();
  await page.getByRole("searchbox").fill("Sénégal");
  await page.getByText("Sénégal", { exact: true }).click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/inscription$/);
}

// Trois questions, une inscription vérifiée par email, puis l'onboarding entier.
test.describe.configure({ timeout: 90_000 });

for (const roleCase of ROLE_CASES) {
  test(`${roleCase.label} : chaque question une seule fois, de l'accueil au fil`, async ({
    page,
  }, testInfo) => {
    await answerIntro(page, roleCase);

    const handle = uniqueHandle(roleCase.prefix, testInfo.project.name);
    await signUpVerifyAndSignIn(page.request, `${handle}@test.kemet`, handle);
    await page.goto("/bienvenue");

    const seen: string[] = [];
    for (const expected of roleCase.onboarding) {
      const heading = page.getByRole("heading", { level: 1, name: expected });
      await expect(heading).toBeVisible();
      seen.push(expected);
      await page.getByRole("button", { name: "Passer" }).click();
      await expect(heading).toHaveCount(0);
    }

    await expect(page).toHaveURL(/\/fil$/);
    expect(seen).not.toContain(COUNTRY);
    expect(seen).not.toContain(ROLE);
    const me = await (await page.request.get("/api/me")).json();
    expect(me.profile).toMatchObject({ role: roleCase.role, country: "SN" });
    expect(me.onboarding.completed).toBe(true);
  });
}

test("Rejoins des espaces : seule la liste défile, titre et Continuer restent à l'écran", async ({
  page,
}, testInfo) => {
  const handle = uniqueHandle("e2earrspc", testInfo.project.name);
  await signUpVerifyAndSignIn(page.request, `${handle}@test.kemet`, handle);
  await page.request.patch("/api/me/onboarding", { data: { step: "spaces" } });
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 560 });
  await page.goto("/bienvenue/espaces");

  const title = page.getByRole("heading", { level: 1, name: SPACES });
  const submit = page.getByRole("button", { name: "Continuer" });
  await expect(title).toBeInViewport();
  await expect(submit).toBeInViewport();
  const pageScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(pageScroll).toBeLessThanOrEqual(1);
});
