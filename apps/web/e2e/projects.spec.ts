import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const PASSWORD = "une-passphrase-solide";

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
}

async function findVerificationUrl(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/messages`).then((response) => response.json());
    const message = (list.messages as MailpitMessage[]).find((candidate) =>
      candidate.To.some((recipient) => recipient.Address === email),
    );
    if (message) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`).then((response) =>
        response.json(),
      );
      const match = (detail.HTML as string).match(/href="([^"]+)"/);
      if (match) return match[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Email de vérification introuvable pour ${email}.`);
}

async function signUpVerifyAndSignIn(
  request: APIRequestContext,
  email: string,
  handle: string,
): Promise<void> {
  await request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name: handle },
  });
  const verificationUrl = new URL(await findVerificationUrl(email));
  await request.get(verificationUrl.pathname + verificationUrl.search);
  await request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
  await request.patch("/api/me/profile", { data: { handle, displayName: handle, country: "SN" } });
}

async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

test("publie un projet et le retrouve sur sa page", async ({ page, request }) => {
  const unique = `${test.info().project.name}-${Date.now()}`;
  const email = `e2e-projects-${unique}@test.kemet`;
  // handleSchema limite à 30 caractères : un préfixe plus long déborde dès
  // que le nom du projet Playwright est "desktop" (7 lettres).
  const handle = `e2eprj${unique}`.replace(/-/g, "");
  const name = `Projet e2e ${unique}`;
  const slug = `projet-e2e-${unique}`;

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/projets");
  // Sur une liste vide, l'en-tête porte un lien "Publier" et l'état vide un
  // bouton "Publier un projet" : les deux mènent à la même page.
  await page.getByRole("link", { name: "Publier", exact: true }).click();
  await expect(page).toHaveURL(/\/projets\/nouveau$/);
  await page.getByLabel("Nom").fill(name);
  await page
    .getByLabel("Présentation en une phrase")
    .fill("Un projet créé par le test de bout en bout des projets.");
  await page.getByLabel("Lien du dépôt").fill("https://github.com/exemple/projet-e2e");
  await page.getByRole("button", { name: "Publier", exact: true }).click();

  // La page de création renvoie directement sur la page du projet.
  await expect(page).toHaveURL(new RegExp(`/projets/${slug}`));
  await expect(page.getByRole("heading", { name })).toBeVisible();
});
