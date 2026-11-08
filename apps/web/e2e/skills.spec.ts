import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { completeProfile } from "./support/accounts.js";

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
  await completeProfile(request, handle);
}

async function signInBrowser(page: Page, email: string): Promise<void> {
  await page.request.post("/api/auth/sign-in/email", { data: { email, password: PASSWORD } });
}

test("publie un skill et le retrouve sur sa page publique", async ({ page, request }) => {
  const email = `e2e-skills-${test.info().project.name}-${Date.now()}@test.kemet`;
  const handle = `e2eskill${test.info().project.name}${Date.now()}`;
  const slug = `skill-${test.info().project.name}-${Date.now()}`.toLowerCase();

  await signUpVerifyAndSignIn(request, email, handle);
  await signInBrowser(page, email);

  await page.goto("/skills");
  await page.getByRole("link", { name: "Publier", exact: true }).click();
  await expect(page).toHaveURL(/\/skills\/nouveau$/);

  await page.getByLabel("Nom").fill(slug);
  await page.getByLabel(/Description/).fill("Une phrase qui explique quand utiliser ce skill.");
  await page
    .getByLabel(/Contenu/)
    .fill("Instructions détaillées pour ce skill de test bout en bout.");
  await page.getByRole("button", { name: "Publier", exact: true }).click();

  // La page renvoie vers la liste une fois le skill publié.
  await expect(page).toHaveURL(/\/skills$/);
  await page.getByLabel("Chercher un skill").fill(slug);
  await expect(page.getByRole("link", { name: new RegExp(slug) })).toHaveCount(1);
  await page.getByLabel("Chercher un skill").fill(`${slug}-introuvable`);
  await expect(page.getByText(/Aucun skill ne correspond/)).toBeVisible();
  await page.getByLabel("Chercher un skill").fill(slug);
  await page.getByRole("link", { name: new RegExp(slug) }).click();
  await expect(page.getByRole("heading", { name: slug })).toBeVisible();
});
